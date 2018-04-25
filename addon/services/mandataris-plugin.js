import { A } from '@ember/array';
import EmberObject from '@ember/object';
import memoize from '../utils/memoize';
import Service, { inject as service } from '@ember/service';
import lblodUriMap from '../utils/lblod-uri-map';
import rdfaCardAnnotationsMap from '../utils/rdfa-card-annotations-map';

/**
* RDFa Editor plugin that hints mandatarissen when typing their name.
*
* @module editor-mandataris-plugin
* @class RdfaEditorMandatarisPlugin
* @extends Ember.Service
*/
export default Service.extend({
  /*********************************
   * HACK TO COOP WITH BROKEN PLUGIN
   *********************************/
  bestuurseenhedenfilter: { // eslint-disable-line ember/avoid-leaking-state-in-ember-objects
    'filter[bekleedt][bevat-in][is-tijdsspecialisatie-van][bestuurseenheid][naam]': 'Niel',
    page: { size: 1000 }
  },
  store: service(),

  /**
   * Flag whether the mandatarissen are already loaded
   *
   * @property mandatarissenLoaded
   * @type boolean
   * @default false
   * @private
  */
  mandatarissenLoaded: false,

  /**
   * Mapping of RDFa context to HTML snippets to insert
   *
   * @property contextMap
   * @type object
   * @private
  */
  contextMap: null,

  /**
   * @property who
   * @type string
   * @default 'editor-plugins/mandataris-card'
   *
   * @private
  */
  who: 'editor-plugins/mandataris-card',

  init() {
    this.set('memoizedTokenize', memoize(this.tokenize.bind(this)));
    this.set('tokensCache', {});
    this.set('contextMap', rdfaCardAnnotationsMap());
  },

  /**
   Handles the incoming events from the editor dispatcher

   @method execute

   @param {string} hrId Unique identifier of the event in the hintsRegistry
   @param {Array} contexts RDFa contexts of the text snippets the event applies on
   @param {Object} hintsRegistry Registry of hints in the editor
   @param {Object} editor The RDFa editor instance

   @return {Promise} A promise that updates the hintsRegistry with the correct hints

   @public
   */
  async execute(hrId, contexts, hintsRegistry, editor) {
    if (contexts.length === 0) return;

    let cards = [];

    for(let context of contexts){
      let rdfaCardTemplateData = this.detectRdfaTemplateMapToUse(context);

      if(!rdfaCardTemplateData) continue;

      let hints = await this.generateHintsForContext(context);

      //remove previous hints
      hintsRegistry.removeHintsInRegion(context.region, hrId, this.get('who'));

      cards.push(...this.generateCardsForHints(rdfaCardTemplateData, hrId, hintsRegistry, editor, hints));
    }

    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  },

  /**
   Detects which rdfa template to use

   //TODO: rethink filtering

   @method detectRdfaTemplateToUse

   @param {Object} context

   @return {Object} template

   @private
   */
  detectRdfaTemplateMapToUse(context){
    //zitting should be last element in context
    let isZitting = node => {  return node.predicate == 'a' && node.object == lblodUriMap.zittingUri; };
    if(context.context.findIndex(isZitting) === context.context.length - 1){
      return this.get('contextMap')[context.context[context.context.length - 1].object];
    }

    //here we want as parent-parent ontslagbesluit or aanstellingsbesluit
    let isRelevantParentContext = node => {
      return node.predicate == 'a' && (node.object === lblodUriMap.ontslagBesluitUri || node.object === lblodUriMap.aanstellingsBesluitUri);
    };
    let contextNodes = context.context.filter(isRelevantParentContext);

    if(contextNodes.length == 0){
      return "";
    }

    //our predicate should only work in 'artikel'
    let isArtikel = node => { return node.predicate == 'a' && node.object == lblodUriMap.artikelUri; };

    if(context.context.findIndex(isArtikel) < 0){
      return "";
    }

    let isMandataris = node => { return node.predicate == 'a' && node.object == lblodUriMap.mandatarisUri; };

    //We don't want to scan mandataris again
    if(isMandataris(context.context.slice(-1)[0])){
      return "";
    }

    return this.get('contextMap')[contextNodes[0].object];
  },

  /**
   Tokenizes string in words, scans for capital letter,
   groups (till arbitrary cutoff), keeps location (in original string) and santizes string.

   @method tokenize

   //TODO: clean up
   @param {string} [start, end] 'Felix  ruiz  '

   @return {Object}

     [{"location":[0,6],
     "sanitizedString":"Felix"},

    {"location":[0,12],
      "sanitizedString": "Felix ruiz"}
    ]

   @private
   */
  tokenize(string){
    //TODO: cleanup
    let minTokenStringLength = 3;
    let maxGroupSize = 5;
    let words = string.match(/\S+\s*/g);
    let tokens = [];

    if(!words){
      return tokens;
    }

    for(let i=0; i < words.length; ++i){

      if(!this.startsWithCapital(words[i])){
        continue;
      }

      for(let j=i+1; j < i + 1 + maxGroupSize && j <= words.length; ++j){
        let wordsGroup =  words.slice(i, j);
        let token = {location: this.mapLocationOfWordsGroup(string, words, wordsGroup, i), sanitizedString: this.wordsToSanitizedString(wordsGroup)};
        if(!token.sanitizedString || token.sanitizedString.length < minTokenStringLength){
          break;
        }
        tokens.push(token);
      }
    }

    return tokens;
  },

  /**
   check if word starts with capital letter

   @method startsWithCapital

   @param {string} word

   @return {bool}

   @private
   */
  startsWithCapital(word){
    return word[0] === word[0].toUpperCase();
  },

  /**
   helper function:
   given a sub array of a words array, we want to know what the location is of these words in the original string
   @method mapLocationOfWordsGroup

   @param {string} 'felix  ruiz de arcaute'
   @param {array} ['felix  ', 'ruiz ', 'de ', 'arcaute']
   @param {array} ['ruiz ', 'de ']
   @param {int}   e.g 1 (index of the words array where the location should start)

   @return {array} [7, 14]

   @private
   */
  mapLocationOfWordsGroup(origString, words, wordsGroup, currentWordsIndex){
    let subString = wordsGroup.join("").trim();
    let startIndex = words.slice(0, currentWordsIndex).join("").length;
    let origStringIndex = origString.indexOf(subString, startIndex);
    return [origStringIndex, origStringIndex + subString.length];
  },

  /**
   joins array of words and trims them and make nice string

   @method wordsToSanitizedString

   @param {array} words

   @return {string}

   @private
   */
  wordsToSanitizedString(words){
    return words.map(word => word.trim()).join(" ");
  },

  /**
   given token, hits cache

   @method hitTokensCache

   @param {object} token

   @return {object} Ember array

   @private
   */
  hitTokensCache(token){
    return this.get('tokensCache')[token.sanitizedString] || A();
  },

  /**
   given token and mandatarissen, updates cache

   @method updateTokensCache

   @param {object} token
   @param {object} ember array mandatarissen

   @return {object} Ember array

   @private
   */
  updateTokensCache(token, mandatarissen){
    this.get('tokensCache')[token.sanitizedString] = mandatarissen;
  },

  /**
   checks if token exists in cache

   @method cacheHasToken

   @param {object} token

   @return {boolean}

   @private
   */
  cacheHasToken(token){
    return token.sanitzedString in this.get('tokensCache');
  },

  /**
   given token with partial (potential) name, find linked mandatarissen

   @method findPartialMatchingMandatarissen

   @param {object} token

   @return {object} Ember array

   @private
   */
  async findPartialMatchingMandatarissen(token){
    //TODO: refine query
    let startsGebruikteVoornaam = mandataris => {
      return (mandataris.get('isBestuurlijkeAliasVan.gebruikteVoornaam') || "").toLowerCase().startsWith(token.sanitizedString.toLowerCase());
    };

    let startsAchternaam = mandataris => {
      return (mandataris.get('isBestuurlijkeAliasVan.achternaam') || "").toLowerCase().startsWith(token.sanitizedString.toLowerCase());
    };

    let startsFullName = mandataris => {
      return (mandataris.get('isBestuurlijkeAliasVan.fullName') || "").toLowerCase().startsWith(token.sanitizedString.toLowerCase());
    };

    if(!this.get('mandatarissenLoaded')){
      let queryParams =  {include:'is-bestuurlijke-alias-van,bekleedt,bekleedt.bestuursfunctie'};
      queryParams = Object.assign(queryParams, this.get('bestuurseenhedenfilter'));

      await this.get('store').query('mandataris', queryParams);
      this.set('mandatarissenLoaded', true);
    }

    return this.get('store').peekAll('mandataris').filter(mandataris => {
      return startsFullName(mandataris) ||  startsGebruikteVoornaam(mandataris) || startsAchternaam(mandataris);
    });

  },

  /**
   generates card

   @method generateCard

   @param {object} template object
   @param {object} mandataris ember object
   @param {object} location in the editor (normalized)
   @param {object} hrId
   @param {object} hintsRegistry
   @param {object} editor

   @return {object} card object

   @private
   */
  generateCard(rdfaCardTemplateData, mandataris, location, hrId, hintsRegistry, editor) {
    let rdfaTemplateData = rdfaCardTemplateData(mandataris);
    const card = EmberObject.create({
      location: location,
      info: {mandataris, location, hrId, hintsRegistry, editor, rdfa: rdfaTemplateData.rdfaAnnotation},
      card: rdfaTemplateData.card,
      value: rdfaTemplateData.rdfaAnnotation
    });

    return card;
  },

  /**
   generates cards for array of hints

   @method generateCardsForHints

   @param {object} template object
   @param {object} hrId
   @param {object} hintsRegistry
   @param {object} editor
   @param {array} hints

   @return {object} card object

   @private
   */
  generateCardsForHints(rdfaCardTemplateData, hrId, hintsRegistry, editor, hints){
    let cardsForHint = hint => {
      return hint.mandatarissen.map(mandataris => {
        return this.generateCard(rdfaCardTemplateData, mandataris, hint.normalizedLocation, hrId, hintsRegistry, editor);
       });
    };

    return hints.reduce((cards, hint) => { return cards.concat(cardsForHint(hint)); }, []);
  },

  /**
   Procedure to generate hints.

   @method generateHintsForContext

   @param {object} context

   @return {array} array of hints

   @private
   */
  async generateHintsForContext(context){
    let tokens = await this.get('memoizedTokenize')(context.text);

    let allHints = [];
    for(let token of tokens){

      token.mandatarissen = this.hitTokensCache(token);

      if(this.cacheHasToken(token) && token.mandatarissen.get('length') === 0){
        continue;
      }

      //add the normalized locaton
      token.normalizedLocation = this.normalizeLocation(token.location, context.region);

      if(token.mandatarissen.get('length') === 0){
        token.mandatarissen = await this.findPartialMatchingMandatarissen(token);
        this.updateTokensCache(token, token.mandatarissen);
      }

      if(token.mandatarissen.get('length') === 0){
        continue;
      }

      allHints = allHints.concat(token);
    }

    //post process

    //remove double hints by taking biggest overlapping region (and thus most specific hint)
    //e.g 'Felix Ruiz' should give one hint for 'Felix Ruiz' and not 'Felix', 'Ruiz'
    let cleanedHints = allHints.filter(this.isLargestOverlappingHint);

    return cleanedHints;
  },

  /**
   Checks if hint.location is largest overlapping hint within array.

   @method isLargestOverlappingHint

   @return {boolean}

   @private
   */
  isLargestOverlappingHint(currentHint, currentIndex, hints){
    let containsLocation = (testLocation, refLocation) => {
      return refLocation[0] <= testLocation[0] && testLocation[1] <= refLocation[1];
    };

    let isRealOverlap = (element, index) => {
      return containsLocation(hints[currentIndex].location, hints[index].location) && currentIndex !== index;
    };

    return hints.find(isRealOverlap) === undefined;

  },

  /**
   brings back indexes of sub string to the reference string

   @method normalizeLocation

   @private
   */
  normalizeLocation(location, reference){
    return [location[0] + reference[0], location[1] + reference[0]];
  }
});
