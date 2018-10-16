import EmberObject from '@ember/object';
import memoize from '../utils/memoize';
import Service, { inject as service } from '@ember/service';
import { task, timeout } from 'ember-concurrency';
import { tokenizeNames} from '../utils/text-tokenizing-utils';
/**
* RDFa Editor plugin that hints mandatarissen when typing their name.
*
* @module editor-mandataris-plugin
* @class RdfaEditorMandatarisPlugin
* @extends Ember.Service
*/
export default Service.extend({
  metaModelQuery: service(),
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

    yield Promise.all(contexts.map(async (context) =>{ return this.setBestuurseenheidFromZitting(context); } ));

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

  async setBestuurseenheidFromZitting(context){
    let zitting = context.context.find(t => t.predicate == "a" && t.object == "http://data.vlaanderen.be/ns/besluit#Zitting");
    let orgaan = context.context.find(t => t.predicate === "http://data.vlaanderen.be/ns/besluit#isGehoudenDoor");

    if(!zitting || !orgaan)
      return;

    let eenheden = await this.store.query('bestuurseenheid', { 'filter[bestuursorganen][:uri:]': orgaan.object });

    if(eenheden.length == 0)
      return;

    this.set('bestuurseenheid', eenheden.firstObject);
  },

  /**
   given token with partial (potential) name, find linked mandatarissen

   @method findPartialMatchingMandatarissen

   @param {object} token

   @return {object} Ember array

   @private
   */
  async findPartialMatchingMandatarissen(token){
    let queryParams = {
      include:'is-bestuurlijke-alias-van,bekleedt,bekleedt.bestuursfunctie',
      page: { size: 10000 }
    };

    if(this.bestuurseenheid)
      queryParams['filter[bekleedt][bevat-in][is-tijdsspecialisatie-van][bestuurseenheid][id]'] = this.bestuurseenheid.id;
    else
      return [];

    if(!this.mandatarissenLoaded){
      await this.get('store').query('mandataris', queryParams);
      this.set('mandatarissenLoaded', true);
    }

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
  generateCard(rdfaProperty, mandataris, location, hrId, hintsRegistry, editor) {
    const card = EmberObject.create({
      location: location,
      info: {mandataris, location, hrId, hintsRegistry, editor, rdfaProperty},
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
      rdfaProperties.forEach(rdfaProperty => {
        let card = this.generateCard(rdfaProperty,
                                     hint.mandataris,
                                     hint.normalizedLocation,
                                     hrId, hintsRegistry,
                                     editor);
        cards.push(card);
      });
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
