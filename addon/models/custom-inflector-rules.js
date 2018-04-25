import Inflector from 'ember-inflector';

const inflector = Inflector.inflector;

inflector.irregular("mandataris","mandatarissen");
inflector.irregular("mandaat","mandaten");
inflector.irregular("persoon","personen");
inflector.irregular("bestuursfunctie-code","bestuursfunctie-codes");

// Meet Ember Inspector's expectation of an export
export default {};
