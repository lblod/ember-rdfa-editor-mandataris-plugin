import { A } from '@ember/array';
import EmberObject from '@ember/object';
import memoize from '../utils/memoize';
import Service, { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
/**
* RDFa Editor plugin that hints mandatarissen when typing their name.
*
* @module editor-mandataris-plugin
* @class RdfaEditorMandatarisPlugin
* @extends Ember.Service
*/
export default Service.extend({
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
  execute: task(function * (hrId, contexts, hintsRegistry, editor) {
    if (contexts.length === 0) return;

    let cards = [];

    for(let context of contexts){
      let rdfaCardTemplateData = this.detectRdfaTemplateMapToUse(context);

      if(!rdfaCardTemplateData) continue;

      let hints = yield this.generateHintsForContext(context);

      //remove previous hints
      hintsRegistry.removeHintsInRegion(context.region, hrId, this.get('who'));

      cards.push(...this.generateCardsForHints(rdfaCardTemplateData, hrId, hintsRegistry, editor, hints));
    }

    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }).restartable(),

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

    if(!this.get('mandatarissenLoaded')){
      let queryParams =  {include:'is-bestuurlijke-alias-van,bekleedt,bekleedt.bestuursfunctie'};

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
    const card = EmberObject.create({
      location: location,
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


        continue;
      }

      //add the normalized locaton
      token.normalizedLocation = this.normalizeLocation(token.location, context.region);


      allHints = allHints.concat(token);
    }

    //post process

    //remove double hints by taking biggest overlapping region (and thus most specific hint)
    //e.g 'Felix Ruiz' should give one hint for 'Felix Ruiz' and not 'Felix', 'Ruiz'
    let cleanedHints = allHints.filter(this.isLargestOverlappingHint);

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
