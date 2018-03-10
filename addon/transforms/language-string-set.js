import { typeOf } from '@ember/utils';
import { assert } from '@ember/debug';
import Transform from 'ember-data/transform';

const LangString = function(content,lang){
  this.content = content;
  this.language = lang;
  this.toString = function() {
    return this['content'] + " (" + this['language'] + ")";
  };
};

const LangStringSet = Transform.extend({
  deserialize(serialized) {
    assert(`expected array got ${typeOf(serialized)}`, (!serialized) || (typeOf(serialized) === "array"));

    // the \n we're being send back by mu-cl-resources is not interpreted as a line feed so we have to force it
    serialized = serialized.map(function(item) {
      return new LangString(item['content'].split('\\n').join('\n'), item['language']);
    });

    return serialized;
  },
  serialize(deserialized) {
    assert(`expected array got ${typeOf(deserialized)}`, (!deserialized) || (typeOf(deserialized) === "array"));
    return deserialized;
  }
});

export {LangStringSet as default, LangString};
