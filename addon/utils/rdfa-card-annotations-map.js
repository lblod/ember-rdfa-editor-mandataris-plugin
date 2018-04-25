import lblodUriMap from './lblod-uri-map';

export default function rdfaCardAnnotationsMap() {
  let rdfaAnnotationsMap = {};

  rdfaAnnotationsMap[lblodUriMap.ontslagBesluitUri] = (mandataris) => {
    return {
      card: 'editor-plugins/mandataris-card',
      rdfaAnnotation:
      `<span class="annotation" property="mandaat:bekrachtigtOntslagVan" resource="${mandataris.get('uri')}" typeof="mandaat:Mandataris">${mandataris.get('isBestuurlijkeAliasVan.fullName')} (${mandataris.get('bekleedt.bestuursfunctie.label')})</span>`
    };
  };

  rdfaAnnotationsMap[lblodUriMap.aanstellingsBesluitUri] = (mandataris) => {
    return {
      card: 'editor-plugins/mandataris-card',
      rdfaAnnotation:
      `<span class="annotation" property="mandaat:bekrachtigtAanstellingVan" resource="${mandataris.get('uri')}" typeof="mandaat:Mandataris">
         ${mandataris.get('isBestuurlijkeAliasVan.fullName')} (${mandataris.get('bekleedt.bestuursfunctie.label')})
       </span>`
    };
  };

  //TODO: some cases still need to be resolved.
  // - decent filter on predefined list of mandaten in this context
  // - when we have a mandataris ->  besluit:heeftVoorzitter should be used as property (idem for secretaris) (we need predefined list of mandaten)
  // - what if secretaris or voorzitter are not present? Then we should think about a function similar to 'zoek harder' where one should
  // manually label a gemeenteraadslid as besluit:heeftVoorzitter or besluit:secretaris
  rdfaAnnotationsMap[lblodUriMap.zittingUri] = (mandataris) => {
    return {
      card: 'editor-plugins/zitting-aanwezig-card',
      rdfaAnnotation:
      `<span class="annotation" property="besluit:heeftAanwezigeBijStart"  resource="${mandataris.get('uri')}" typeof="mandaat:Mandataris">
         ${mandataris.get('isBestuurlijkeAliasVan.fullName')} (${mandataris.get('bekleedt.bestuursfunctie.label')})
       </span>`
    };
  };

  return rdfaAnnotationsMap;
}
