import Component from '@ember/component';
import { computed } from '@ember/object';
import layout from '../../templates/components/editor-plugins/mandataris-card';
import InsertResourceRelationCardMixin from '@lblod/ember-rdfa-editor-generic-model-plugin-utils/mixins/insert-resource-relation-card-mixin';

export default Component.extend(InsertResourceRelationCardMixin, {
  layout,
  hintOwner: 'editor-plugins/mandataris-card',

  serializeToJsonApi(resource){
    //This is because we're not sure uri is kept (due to bug in mu-cl-resources/or ember-ds?)
    let serializedResource = resource.serialize({includeId: true});
    serializedResource.data.attributes.uri = resource.uri;
    return serializedResource;
  },

  mandatarisCombinedWithProperties: computed('info', function(){
    return this.get('info.rdfaProperties').map(prop => {
      return {mandataris: this.get('info.mandataris'),
              prop: prop};
    });
  }),

  actions: {
    async refer(data){
      let mandatarisJsonApi = this.serializeToJsonApi(data.mandataris);
      let rdfaRefer = await this.getReferRdfa(await data.prop,
                                              mandatarisJsonApi,
                                              data.mandataris.isBestuurlijkeAliasVan.get('fullName'));
      let mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), this.hintOwner);
      this.get('editor').replaceTextWithHTML(...mappedLocation, rdfaRefer, [{ who: 'editor-plugins/mandataris-card' }]);

    },
    async extend(data){
      let mandatarisJsonApi = this.serializeToJsonApi(data.mandataris);
      let rdfaExtended = await this.getExtendedRdfa(data.prop, mandatarisJsonApi);
      let mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), this.hintOwner);
      this.get('editor').replaceTextWithHTML(...mappedLocation, rdfaExtended, [{ who: 'editor-plugins/mandataris-card' }]);
    }
  }
});
