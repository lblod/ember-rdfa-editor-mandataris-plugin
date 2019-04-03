import EmberObject from '@ember/object';
import memoize from '../utils/memoize';
import Service, { inject as service } from '@ember/service';
import { task, timeout } from 'ember-concurrency';
import { tokenizeNames} from '../utils/text-tokenizing-utils';

/**
* RDFa Editor plugin that hints mandatarissen when typing their name.
 * ---------------------------------------------------
 * CODE REVIEW NOTES
 * ---------------------------------------------------
 *
 *  INTERACTION PATTERNS
 *  --------------------
 *  For all incoming contexts, first looks whether there is a property which may be found with range Mandataris.
 *  If encountered, scan text (with some weird tokenizing for names logic) if a potential name can be matched.
 *  If mandataris(sen) are found, cards with suggestions to insert them are generated.
 *  The highlighting occurs within async call.
 *
 *  POTENTIAL ISSUES/TODO
 *  ---------------------
 *  - The tokenizing might be too complex and restrictive at the same time.
 *  - The restartable task is problematic, at restart other context then the intial ones may be provided.
 *     It also needs to be invistigated wether the async highlight could result in double hinting.
 *     e.g.: 'Felix' is highlighted but a slow response from a previous iteration might also add a hint at 'Feli'
 *     This is unlikely here, as the fetching of mandatarissen occurs upfront, but might be problematic in e.g citaten plugin
 *
 *  OTHER INFO
 *  ----------
 *  - uses metamodel plugin utils to:
 *    to fetch the correct property the reference of the mandataris should reside in.
 * ---------------------------------------------------
 * END CODE REVIEW NOTES
 * ---------------------------------------------------
*
* @module editor-mandataris-plugin
* @class RdfaEditorMandatarisPlugin
* @extends Ember.Service
*/
export default Service.extend({
  metaModelQuery: service(),
  store: service(),

  /**
   * @property who
   * @type string
   * @default 'editor-plugins/mandataris-card'
   *
   * @private
  */
  who: 'editor-plugins/mandataris-card',

  init() {
    this._super(...arguments);
    this.set('memoizedTokenize', memoize(tokenizeNames.bind(this)));
    this.set('memoizedFindPropertiesWithRange',
             memoize((classType, range) => this.metaModelQuery.findPropertiesWithRange(classType, range)));
  },

  /**
   * Restartable task to handle the incoming events from the editor dispatcher
   *
   * @method execute
   *
   * @param {string} hrId Unique identifier of the event in the hintsRegistry
   * @param {Array} contexts RDFa contexts of the text snippets the event applies on
   * @param {Object} hintsRegistry Registry of hints in the editor
   * @param {Object} editor The RDFa editor instance
   *
   * @public
   */
  execute: task(function * (hrId, contexts, hintsRegistry, editor, extraInfo = []) {
    if (contexts.length === 0) return;

    //if we see event was triggered by this plugin, ignore it
    if(extraInfo.find(i => i && i.who == this.who))
      return;

    yield this.loadMandatarissenForZitting();

    yield timeout(300);

    let cards = [];

    for(let context of contexts){

      let rdfaProperties = yield this.detectRdfaPropertiesToUse(context);

      if(rdfaProperties.length == 0) continue;

      let hints = yield this.generateHintsForContext(context);

      if(hints.length == 0) continue;

      hintsRegistry.removeHintsInRegion(context.region, hrId, this.get('who'));

      cards.push(...this.generateCardsForHints(rdfaProperties, hrId, hintsRegistry, editor, hints));
    }

    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }).restartable(),

  async detectRdfaPropertiesToUse(context){
    let lastTriple = context.context.slice(-1)[0] || {};
    if(!lastTriple.predicate == 'a')
      return [];
    let classType = lastTriple.object;
    if(classType.trim().length == 0) return [];
    return this.memoizedFindPropertiesWithRange(classType.trim(), 'http://data.vlaanderen.be/ns/mandaat#Mandataris');
  },

  async loadMandatarissenForZitting(){
    let node = document.querySelectorAll("[property='http://data.vlaanderen.be/ns/besluit#isGehoudenDoor']")[0];
    if(!node || !node.attributes || !node.attributes.resource || !node.attributes.resource.value)
      return;

    let bestuursorgaanUri = node.attributes.resource.value;
    if(this.get('bestuursorgaanInTijd') == bestuursorgaanUri)
      return;

    this.set('bestuursorgaanInTijd', bestuursorgaanUri);
    await this.store.unloadAll('persoon');
    await this.store.unloadAll('mandataris');
    await this.store.unloadAll('mandaat');

    //start loading
    let queryParams = {
      include:'is-bestuurlijke-alias-van,bekleedt,bekleedt.bestuursfunctie',
      'filter[bekleedt][bevat-in][:uri:]': bestuursorgaanUri,
      page: { size: 10000 }
    };

    await this.get('store').query('mandataris', queryParams);
  },

  /**
   given token with partial (potential) name, find linked mandatarissen

   @method findPartialMatchingMandatarissen

   @param {object} token

   @return {object} Ember array

   @private
   */
  async findPartialMatchingMandatarissen(token){

    let startsGebruikteVoornaam = mandataris => {
      return (mandataris.get('isBestuurlijkeAliasVan.gebruikteVoornaam') || "").toLowerCase().startsWith(token.sanitizedString.toLowerCase());
    };

    let startsAchternaam = mandataris => {
      return (mandataris.get('isBestuurlijkeAliasVan.achternaam') || "").toLowerCase().startsWith(token.sanitizedString.toLowerCase());
    };

    let startsFullName = mandataris => {
      return (mandataris.get('isBestuurlijkeAliasVan.fullName') || "").toLowerCase().startsWith(token.sanitizedString.toLowerCase());
    };

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
  generateCard(rdfaProperties, mandataris, location, hrId, hintsRegistry, editor) {
    const card = EmberObject.create({
      location: location,
      info: {mandataris, location, hrId, hintsRegistry, editor, rdfaProperties},
      card: this.who
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
  generateCardsForHints(rdfaProperties, hrId, hintsRegistry, editor, hints){
    let cards = [];
    hints.forEach(hint => {
      let card = this.generateCard(rdfaProperties,
                                   hint.mandataris,
                                   hint.normalizedLocation,
                                   hrId, hintsRegistry,
                                   editor);
      cards.push(card);
    });
    return cards;
  },

  /**
   Procedure to generate hints.
   TODO: clean up!!

   @method generateHintsForContext

   @param {object} context

   @return {array} array of hints

   @private
   */
  async generateHintsForContext(context){
    let tokens = await this.get('memoizedTokenize')(context.text);

    let allHints = [];

    for(let token of tokens){
      let mandatarissen = await this.findPartialMatchingMandatarissen(token);

      if(mandatarissen.length === 0){
        continue;
      }

      //add the normalized locaton
      token.normalizedLocation = this.normalizeLocation(token.location, context.region);

      token.mandatarissen = mandatarissen;

      allHints = allHints.concat(token);
    }

    //post process

    //remove double hints by taking biggest overlapping region (and thus most specific hint)
    //e.g 'Felix Ruiz' should give one hint for 'Felix Ruiz' and not 'Felix', 'Ruiz'
    let cleanedHints = allHints.filter(this.isLargestOverlappingHint);

    let flattenedHints = [];

    cleanedHints.forEach(h => {
      h.mandatarissen.forEach(m => {
        flattenedHints.push({
          location: h.location,
          normalizedLocation: h.normalizedLocation,
          mandataris: m
        });
      });
    });

    return flattenedHints;
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
