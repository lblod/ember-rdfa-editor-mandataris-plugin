import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | editor plugins/mandataris card', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {

    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    await render(hbs`{{editor-plugins/mandataris-card}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    await render(hbs`
      {{#editor-plugins/mandataris-card}}
        template block text
      {{/editor-plugins/mandataris-card}}
    `);

    assert.dom('*').hasText('template block text');
  });
});
