import Mixin from '@ember/object/mixin';
import { computed } from '@ember/object';
import DS from 'ember-data';

export default Mixin.create({
  // A string representation of this model, based on its attributes.
  // This is what mu-cl-resources uses to search on, and how the model will be presented while editing relationships.
  stringRep: computed.collect.apply(this,['id', 'start', 'einde']),

  //rangorde: attr('language-typed-string'),
  start: DS.attr('datetime'),
  einde: DS.attr('datetime'),
  beleidsdomein: DS.attr('string-set'),
  status: DS.attr(),
  uri: DS.attr(),

  bekleedt: DS.belongsTo('mandaat', {inverse: null }),
  isBestuurlijkeAliasVan: DS.belongsTo('persoon', {inverse: 'isAangesteldAls'}),
  tijdelijkeVervangingen: DS.hasMany('mandataris', {inverse: null })

});
