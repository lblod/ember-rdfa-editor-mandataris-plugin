# @lblod/ember-rdfa-editor-mandataris-plugin
:warning: This ember addon is no longer maintained.

RDFa editor plugin to insert mandatarissen in the editor.

## Use
If context is detected where mandataris is availible as property, the plugin will try to find names.
Start a name with capital letter.

## Installation

Install the plugin like an Ember addon in your host application.

```
ember install @lblod/ember-rdfa-editor-mandataris-plugin.git
```

### Dispatcher configuration
The plugin will automatically be added to the `default` and `all` profile in the editor's dispatcher configuration in `app/config/editor-profiles.js`.
