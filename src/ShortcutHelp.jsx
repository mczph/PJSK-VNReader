import React from 'react';
const keys=[['Space / Enter / →','下一句'],['←','上一句'],['A','自动播放 / 停止'],['K / 按住 Ctrl','快进'],['S / F5','快速存档'],['Shift+S','打开存档菜单'],['L','打开读档菜单'],['F9','读取快速存档'],['B / Backspace','Backlog'],['J','剧情跳转'],['V','重播配音'],['H','隐藏 / 显示对白'],['Esc','阅读设置 / 关闭菜单'],['F / F11','全屏（F11 为桌面快捷键）']];
export default function ShortcutHelp(){return <div className="options-help"><b>键盘快捷键</b>{keys.map(([key,label])=><p key={key}><kbd>{key}</kbd> · {label}</p>)}<p>剧情快捷键在阅读时生效。输入文字时不触发；窗口最小化后暂停声音和演出。</p></div>;}
