import EmberObject from '@ember/object';
import MandatarisMixin from 'ember-rdfa-editor-mandataris-plugin/mixins/mandataris';
import { module, test } from 'qunit';

module('Unit | Mixin | mandataris');

// Replace this with your real tests.
test('it works', function(assert) {
  let MandatarisObject = EmberObject.extend(MandatarisMixin);
  let subject = MandatarisObject.create();
  assert.ok(subject);
});
