import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/mandataris-card';
import ResourceRelationCardMixin from '@lblod/ember-generic-model-plugin-utils/mixins/resource-relation-card-mixin';

export default Component.extend(ResourceRelationCardMixin, {
  layout,

  serializeToJsonApi(resource){
    //This is because we're not sure uri is kept (due to bug in mu-cl-resources/or ember-ds?)
    let serializedResource = resource.serialize({includeId: true});
    serializedResource.data.attributes.uri = resource.uri;
    return serializedResource;
  },

  actions: {
    async refer(data){
      this.refer(await data.rdfaProperty,
                 this.serializeToJsonApi(data.mandataris),
                 data.mandataris.isBestuurlijkeAliasVan.get('fullName'),
                 'editor-plugins/mandataris-card',
                 [{ who: 'editor-plugins/mandataris-card' }]);
    },
    async extend(data){
      await this.extend(await data.rdfaProperty,
                        this.serializeToJsonApi(data.mandataris),
                        'editor-plugins/mandataris-card',
                       [{ who: 'editor-plugins/mandataris-card' }]);
    }
  }
});
