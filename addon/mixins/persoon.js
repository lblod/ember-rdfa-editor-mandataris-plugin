import Mixin from '@ember/object/mixin';
import { computed } from '@ember/object';
import DS from 'ember-data';

export default Mixin.create({
  // A string representation of this model, based on its attributes.
  // This is what mu-cl-resources uses to search on, and how the model will be presented while editing relationships.
  stringRep: computed.collect.apply(this,['id', 'achternaam', 'alternatieveNaam', 'gebruikteVoornaam', 'geslacht']),

  fullName: computed('gebruikteVoornaam', 'achternaam', function() {
    return `${this.get('gebruikteVoornaam')} ${this.get('achternaam')}`;
  }),

  achternaam: DS.attr(),
  alternatieveNaam: DS.attr(),
  gebruikteVoornaam: DS.attr(),
  geslacht: DS.attr(),
  uri: DS.attr(),

  isAangesteldAls: DS.hasMany('mandataris', {inverse: 'isBestuurlijkeAliasVan'})
});
