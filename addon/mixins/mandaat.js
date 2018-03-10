import Mixin from '@ember/object/mixin';
import { computed } from '@ember/object';
import DS from 'ember-data';

export default Mixin.create({
  // A string representation of this model, based on its attributes.
  // This is what mu-cl-resources uses to search on, and how the model will be presented while editing relationships.
  stringRep: computed.collect.apply(this,['id', 'aantalHouders', 'bestuursfunctie']),

  aantalHouders: DS.attr(),
  bestuursfunctie: DS.attr(),
  uri: DS.attr()
});
