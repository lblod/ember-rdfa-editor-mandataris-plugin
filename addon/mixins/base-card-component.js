import Mixin from '@ember/object/mixin';
import { reads } from '@ember/object/computed';

export default Mixin.create({
  editor: reads('info.editor'),
  hintsRegistry: reads('info.hintsRegistry'),
  hrId: reads('info.hrId'),
  location: reads('info.location'),

  actions: {
    insert() {
      const updatedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), 'editor-plugins/mandataris-card');
      this.get('editor').replaceTextWithHTML(...updatedLocation, this.get('info').rdfa);
    }
  }
});
