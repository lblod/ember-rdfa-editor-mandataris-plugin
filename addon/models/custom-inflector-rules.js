import Inflector from 'ember-inflector';

const inflector = Inflector.inflector;

inflector.irregular("mandataris","mandatarissen");
inflector.irregular("mandaat","mandaten");
inflector.irregular("persoon","personen");

// Meet Ember Inspector's expectation of an export
export default {};
