// Avoid stealing text entry, browser/system shortcuts, or activating a focused
// button twice via its native Enter/Space behavior.
export function shortcutAction(event){
 if(event.defaultPrevented||event.isComposing||event.metaKey||event.altKey)return null;
 const target=event.target;
 if(target?.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return null;
 if(event.key==='Control')return 'holdSkip';
 if(event.ctrlKey)return null;
 const key=event.key.toLowerCase();
 if([' ','enter'].includes(key)&&target?.closest?.('button,a,summary'))return null;
 const action=({' ':'next',enter:'next',arrowright:'next',arrowleft:'previous',a:'auto',k:'skip',b:'log',backspace:'log',h:'hide',s:event.shiftKey?'save':'quickSave',l:'load',f5:'quickSave',f9:'quickLoad',j:'jump',v:'voice',escape:'settings',f:'fullscreen'})[key];
 if(event.repeat&&!['next','previous'].includes(action))return null;
 return action || null;
}

export const shortcutHints={auto:'A',skip:'K / 按住 Ctrl',save:'Shift+S',load:'L',log:'B / Backspace',jump:'J',voice:'V',hide:'H',settings:'Esc',fullscreen:'F / F11',previous:'←',next:'Space / Enter / →'};
