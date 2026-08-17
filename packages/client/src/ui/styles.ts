/**
 * 客户端面板样式（scoped，`dshs-` 前缀避免污染 DSH 全局）。
 * 明暗主题通过根节点 `[data-theme]` 切换 CSS 变量。
 */
export const STORE_CSS = `
.dshs-root{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.dshs-root *{box-sizing:border-box;margin:0;padding:0;scrollbar-width:none;-ms-overflow-style:none}
.dshs-root *::-webkit-scrollbar{width:0;height:0;display:none;background:transparent}
.dshs-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.dshs-root{--brand1:#6a5cff;--brand2:#00c2a8;--gold:#f5a623;--up:#2ea043;--danger:#ff6b6b}
.dshs-root[data-theme=dark]{--bg:#0d1117;--bg2:#161b22;--bg3:#1c2330;--line:#2b3340;--tx:#e6edf3;--tx2:#8b98a5;--card:#161b22;--hover:#1f2630}
.dshs-root[data-theme=light]{--bg:#f2f4f8;--bg2:#fff;--bg3:#eef1f6;--line:#d8dee8;--tx:#1c2330;--tx2:#5b6675;--card:#fff;--hover:#f0f3f8}
.dshs-fab{position:fixed;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--brand1),var(--brand2));display:flex;align-items:center;justify-content:center;font-size:24px;cursor:grab;box-shadow:0 6px 22px rgba(106,92,255,.45);transition:transform .2s;pointer-events:auto;user-select:none;color:#fff;z-index:2}
.dshs-fab:hover{transform:scale(1.08)}
.dshs-dot{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;border-radius:10px;background:var(--danger);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg);padding:0 5px}
.dshs-dot.blue{top:-2px;left:-2px;right:auto;background:#3b9eff}
.dshs-panel{position:fixed;right:26px;bottom:94px;width:460px;height:680px;min-width:0;min-height:0;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;pointer-events:auto;color:var(--tx);z-index:1}
.dshs-panel.embed{position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;border:none;border-radius:0;box-shadow:none}
.dshs-p-top{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--bg2);flex:none;min-width:0;user-select:none}
.dshs-logo{font-weight:700;font-size:14px;white-space:nowrap;cursor:move;flex:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.dshs-search{flex:1;display:flex;align-items:center;background:var(--bg3);border:1px solid var(--line);border-radius:8px;padding:5px 9px;gap:6px;min-width:0}
.dshs-search input{flex:1;background:none;border:none;outline:none;color:var(--tx);font-size:12.5px;min-width:40px}
.dshs-ico{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--tx2);flex:none;position:relative}
.dshs-ico:hover{background:var(--hover);color:var(--tx)}
.dshs-ico.my{width:auto;padding:0 9px;font-size:12px;font-weight:600}
.dshs-tabs{display:flex;border-bottom:1px solid var(--line);background:var(--bg2);flex:none}
.dshs-cbanner{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 12px;background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.5);border-radius:8px;margin:8px 12px 0;font-size:12px;color:var(--tx);flex:none}
.dshs-cbanner b{color:var(--gold)}
.dshs-cbanner-text{cursor:pointer;min-width:0}
.dshs-cbanner-actions{display:flex;align-items:center;gap:6px;flex:none}
.dshs-cbanner .dshs-ibtn{margin-left:0}
.dshs-cbanner .dshs-abtn{border-color:rgba(245,166,35,.5);color:var(--gold)}
.dshs-tabs button{flex:1;padding:9px 0;font-size:12.5px;color:var(--tx2);border-bottom:2px solid transparent}
.dshs-tabs button.on{color:var(--tx);font-weight:600;border-bottom-color:var(--brand2)}
.dshs-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:14px}

.dshs-sec{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13px;font-weight:700;margin:4px 0 10px;color:var(--tx)}
.dshs-sec span{font-size:11px;color:var(--tx2);font-weight:400}
.dshs-hscroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory}

.dshs-tcard{flex:0 0 200px;scroll-snap-align:start;background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:5px}
.dshs-tcard:hover{border-color:var(--brand2)}
.dshs-rk{font-size:11px;font-weight:800;color:var(--brand2)}
.dshs-nm{font-size:13px;font-weight:700;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dshs-mem .dshs-nm{flex:0 1 auto;max-width:100%}
.dshs-ds{font-size:11.5px;color:var(--tx2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
.dshs-mrow{display:flex;align-items:center;gap:9px;font-size:11.5px;margin-top:auto;flex-wrap:wrap}
.dshs-st{color:var(--gold)}.dshs-dl{color:var(--up)}.dshs-lk{color:var(--brand1)}.dshs-dl7{color:var(--tx2)}
.dshs-like{background:none;border:1px solid var(--line);border-radius:7px;color:var(--tx2);font-size:11px;padding:2px 8px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;margin-left:auto}
.dshs-like:hover{border-color:var(--brand2);color:var(--tx)}
.dshs-like.on{color:var(--danger);border-color:rgba(255,107,107,.55);background:rgba(255,107,107,.08)}
.dshs-root[data-theme=light] .dshs-lk{color:#5a48e8}
.dshs-ibtn{margin-left:auto;background:linear-gradient(135deg,var(--brand1),var(--brand2));color:#fff;font-size:11px;padding:3px 10px;border-radius:6px;white-space:nowrap}
.dshs-ibtn.done{background:var(--bg3);color:var(--tx2);border:1px solid var(--line);cursor:default}
.dshs-vcard{background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:11px 12px;margin-bottom:9px}
.dshs-vcard:hover{border-color:var(--brand2)}
.dshs-l1{display:flex;align-items:center;gap:7px}
.dshs-l1 .dshs-nm{font-size:13.5px}
.dshs-badge{font-size:10px;padding:1.5px 7px;border-radius:8px;border:1px solid var(--line);color:var(--tx2);white-space:nowrap}
.dshs-badge.of{border-color:rgba(0,194,168,.5);color:var(--brand2)}
.dshs-badge.cm{border-color:rgba(245,166,35,.5);color:var(--gold)}
.dshs-badge.wa{border-color:rgba(245,166,35,.5);color:var(--gold)}
.dshs-badge.ba{border-color:var(--danger);color:var(--danger)}
.dshs-compat{font-size:10.5px;color:var(--tx2);margin-left:auto;white-space:nowrap}
.dshs-sortbar{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--tx2);margin:4px 0 9px;flex-wrap:wrap}
.dshs-sortbar button{font-size:11px;padding:3px 10px;border:1px solid var(--line);border-radius:7px;color:var(--tx2)}
.dshs-sortbar button.on{border-color:var(--brand2);color:var(--brand2);font-weight:600}
.dshs-drawer{position:absolute;top:0;right:0;width:92%;height:100%;min-width:0;min-height:0;background:var(--bg2);border-left:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden;color:var(--tx);z-index:3}
.dshs-dh{display:flex;align-items:center;padding:12px;border-bottom:1px solid var(--line);font-weight:700;font-size:13.5px;flex:none;min-height:0}
.dshs-dh button{margin-left:auto;color:var(--tx2);font-size:16px}
.dshs-anno{padding:11px 12px;border-bottom:1px solid var(--line)}
.dshs-anno .t{font-size:13px;font-weight:600;display:flex;gap:7px;align-items:center}
.dshs-lv{font-size:10px;padding:1px 7px;border-radius:8px}
.dshs-lv.imp{background:rgba(255,107,107,.15);color:var(--danger)}
.dshs-lv.inf{background:rgba(0,194,168,.12);color:var(--brand2)}
.dshs-anno .c{font-size:12px;color:var(--tx2);margin-top:5px;line-height:1.6}
.dshs-anno .d{font-size:10.5px;color:var(--tx2);margin-top:5px;opacity:.7}
.dshs-mem{display:flex;align-items:center;flex-wrap:wrap;row-gap:4px;column-gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px;background:var(--bg2);font-size:12.5px;min-width:0}
.dshs-updot{font-size:10px;padding:1.5px 7px;border-radius:8px;background:rgba(59,158,255,.14);color:#3b9eff;white-space:nowrap}
.dshs-empty{padding:26px;text-align:center;color:var(--tx2);font-size:12.5px}
.dshs-x{margin-left:auto;color:var(--danger)}
.dshs-abtn{font-size:11px;padding:4px 10px;border:1px solid var(--line);border-radius:7px;color:var(--tx2);white-space:nowrap}
.dshs-abtn:hover{border-color:var(--brand2);color:var(--brand2)}
.dshs-abtn.dan{color:var(--danger)}
.dshs-pick{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px;background:var(--bg3);font-size:12.5px;cursor:pointer;color:var(--tx);min-width:0;transition:border-color .15s,background .15s}
.dshs-pick:hover{border-color:var(--brand2)}
.dshs-pick.on{border-color:var(--brand2);background:rgba(0,194,168,.08)}
.dshs-pick input{flex:none;accent-color:var(--brand1)}
.dshs-pick .dshs-nm{flex:1;min-width:0}
/* 组合成员安装方式切换：⚡ 自动 / ✋ 手动 */
.dshs-mode{display:inline-flex;gap:4px;flex:none}
.dshs-mode-btn{font-size:10px;padding:2px 8px;border:1px solid var(--line);border-radius:6px;color:var(--tx2);white-space:nowrap;background:var(--bg3)}
.dshs-mode-btn.on{background:linear-gradient(135deg,var(--brand1),var(--brand2));color:#fff;border-color:transparent}
.dshs-mode-btn:hover{border-color:var(--brand2);color:var(--brand2)}
.dshs-mode-btn.on:hover{color:#fff}
/* 商城放置位置开关 */
.dshs-loc-toggle{font-size:10.5px;padding:3px 10px;border:1px solid var(--line);border-radius:8px;color:var(--tx2);white-space:nowrap;background:var(--bg3);cursor:pointer}
.dshs-loc-toggle.on{background:linear-gradient(135deg,var(--brand1),var(--brand2));color:#fff;border-color:transparent}
.dshs-loc-toggle:hover{border-color:var(--brand2);color:var(--brand2)}
.dshs-loc-toggle.on:hover{color:#fff}
/* 云端折叠卡片（插件/组合/Agent 共用）：标题行可点击展开，展开后内容区域变大 */
.dshs-cloudcard{background:var(--bg3);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.dshs-cloudcard-h{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;user-select:none}
.dshs-cloudcard-h:hover{background:var(--hover)}
.dshs-cloudcard-arrow{margin-left:auto;font-size:11px;color:var(--tx2);white-space:nowrap}
.dshs-cloudcard-body{padding:10px 12px 12px;border-top:1px solid var(--line)}
/* 云端组合：组 + 嵌套成员插件 */
.dshs-pick-sub{border:1px solid var(--line);border-radius:9px;margin-bottom:6px;overflow:hidden}
.dshs-pick-sub > .dshs-pick{border:none;border-radius:0;margin-bottom:0;background:var(--bg2)}
.dshs-pick-sub-in{padding:2px 6px 6px 22px;background:var(--bg3)}
.dshs-pick-sub-in .dshs-pick{background:var(--bg3);border-color:var(--line);margin-bottom:4px}
/* 入口标题自定义输入 */
.dshs-loc-title{flex:1;min-width:0;background:var(--bg2);border:1px solid var(--line);border-radius:7px;padding:3px 8px;color:var(--tx);font-size:12px;outline:none}
.dshs-loc-title:focus{border-color:var(--brand2)}
.dshs-loc-title::placeholder{color:var(--tx2);opacity:.6}
.dshs-lib{font-size:10.5px;white-space:nowrap}
.dshs-lib.ok{color:var(--brand2)}
.dshs-lib.warn{color:var(--danger)}
.dshs-pill{font-size:10px;padding:1.5px 7px;border-radius:8px;white-space:nowrap}
.dshs-pill.primary{background:rgba(0,194,168,.14);color:var(--brand2)}
.dshs-pill.lb{background:rgba(59,158,255,.14);color:#3b9eff}
.dshs-pill.ind{background:rgba(245,166,35,.14);color:var(--gold)}
.dshs-pill.off{background:var(--bg3);color:var(--tx2)}
.dshs-pill.err{background:rgba(255,107,107,.14);color:var(--danger)}
.dshs-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:8px;flex-wrap:wrap}
.dshs-mycombo{width:100%;padding:12px 14px;border-radius:11px;background:linear-gradient(135deg,var(--brand1),var(--brand2));color:#fff;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 8px 22px rgba(106,92,255,.28)}
.dshs-mycombo:hover{filter:brightness(1.08)}
.dshs-mycombo-list{display:flex;flex-direction:column;gap:7px;margin-top:9px}
.dshs-mycombo-card{display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--bg3);border:1px solid var(--line);border-radius:10px}
.dshs-mycombo-card:hover{border-color:var(--brand2)}
.dshs-mycombo-card .dshs-nm{flex:1;min-width:0}
.dshs-cloudbox{background:var(--bg2);border:1px solid var(--line);border-radius:11px;padding:10px 11px;margin-bottom:10px}
.dshs-cloud-scroll{max-height:240px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--line);border-radius:9px;padding:8px;background:var(--bg3);margin-top:8px}
.dshs-sub-head{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0}
.dshs-sub-head .dshs-nm{flex:1;min-width:0}
.dshs-sub-members{display:flex;flex-direction:column;gap:6px;margin:8px 0}
.dshs-confirm{display:inline-flex;align-items:center;gap:5px;flex:none}
.dshs-batchbar{display:flex;align-items:center;gap:8px;padding:7px 9px;margin:6px 0 9px;border:1px solid rgba(255,107,107,.35);border-radius:9px;background:rgba(255,107,107,.07)}
.dshs-batchbar .dshs-compat{margin-left:0}
.dshs-src-card{background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px}
.dshs-src-card:hover{border-color:var(--brand2)}
.dshs-src-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.dshs-src-title{display:flex;align-items:center;gap:6px;min-width:0;flex:1}
.dshs-pills{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:60%}
.dshs-src-sub{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;font-size:10.5px;color:var(--tx2)}
.dshs-src-url{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshs-src-add{margin-top:10px;padding:10px 12px;border:1px dashed var(--line);border-radius:12px;background:var(--bg2)}
.dshs-src-add .dshs-frow:last-of-type{margin-bottom:0}
.dshs-input{flex:1;background:var(--bg3);border:1px solid var(--line);border-radius:8px;padding:7px 9px;color:var(--tx);font-size:12px;outline:none;min-width:0}
/* 组合简介：内容增多自动加行（不显示拖拽手柄，超出随弹窗滚动） */
.dshs-desc{resize:none;overflow:hidden;min-height:38px;line-height:1.6;box-sizing:border-box;display:block;width:100%}
.dshs-desc:focus{border-color:var(--brand2)}
.dshs-frow{display:flex;gap:8px;margin-bottom:8px;align-items:center}
.dshs-notif{border:1px solid var(--line);border-left:3px solid #3b9eff;border-radius:9px;padding:9px 11px;margin-bottom:8px;background:var(--bg3)}
.dshs-notif .nt{font-size:12px;color:var(--tx);line-height:1.55}
.dshs-notif .na{display:flex;gap:7px;margin-top:7px}
/* GitHub 登录卡片（「我的」未登录分支）：一键授权,无手动 token */
.dshs-login-card{display:flex;flex-direction:column;align-items:center;text-align:center;padding:26px 16px 20px;border:1px solid var(--line);border-radius:14px;background:var(--bg3);margin-bottom:10px;gap:0}
.dshs-login-gh{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#24292f,#57606a);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.28);margin-bottom:12px}
.dshs-login-gh svg{width:30px;height:30px}
.dshs-login-title{font-size:15px;font-weight:800;color:var(--tx);letter-spacing:.2px}
.dshs-login-sub{font-size:11px;color:var(--tx2);margin-top:4px;line-height:1.5}
.dshs-login-benefits{margin:14px 0 16px;width:100%;display:flex;flex-direction:column;gap:6px}
.dshs-login-benefits div{font-size:12px;color:var(--tx2);text-align:left;padding:7px 10px;background:var(--bg2);border:1px solid var(--line);border-radius:8px;line-height:1.5}
.dshs-login-benefits b{color:var(--tx);font-weight:700}
.dshs-login-benefits .k{color:var(--brand2);font-weight:700;margin-right:6px}
.dshs-login-btn{width:100%;background:linear-gradient(135deg,var(--brand1),var(--brand2));color:#fff;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;box-shadow:0 3px 12px rgba(0,194,168,.25);transition:filter .15s}
.dshs-login-btn:hover{filter:brightness(1.12)}
.dshs-login-btn:active{filter:brightness(.94)}
.dshs-login-hint{font-size:10.5px;color:var(--tx3,#8a94a6);margin-top:9px;line-height:1.5}
/* 组合发布免责声明(双语社会主义核心价值观) */
.dshs-disclaim{border:1px solid rgba(245,166,35,.45);border-left:3px solid var(--gold);border-radius:9px;padding:9px 11px;margin-bottom:8px;background:rgba(245,166,35,.07)}
.dshs-disclaim-t{font-size:11px;font-weight:800;color:var(--gold);margin-bottom:4px}
.dshs-disclaim-b{font-size:11px;color:var(--tx);line-height:1.6}
.dshs-disclaim-v{margin-top:6px;padding-top:6px;border-top:1px dashed rgba(245,166,35,.3);font-size:11px;color:var(--gold);line-height:1.7}
.dshs-disclaim-v span{color:var(--tx2);font-size:10px}
.dshs-grp{background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:11px 12px;margin-bottom:9px}
.dshs-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:20}
.dshs-modal-card{width:84%;max-width:460px;max-height:72%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;color:var(--tx)}
.dshs-modal-card.big{width:92%;max-width:680px;height:86%;max-height:86%}
.dshs-modal-card.big .c{flex:1;overflow-y:auto;display:flex;flex-direction:column;white-space:normal}
.dshs-modal-card .t{font-size:14px;font-weight:700;display:flex;align-items:center;gap:7px;margin-bottom:10px}
.dshs-modal-card .t button{margin-left:auto;color:var(--tx2);font-size:16px}
.dshs-modal-card .c{font-size:12.5px;color:var(--tx2);line-height:1.7;white-space:pre-wrap;overflow-y:auto;min-height:0}
/* 弹窗底部固定操作区：内容可滚动但按钮始终可见（发布组合/提交上报等主操作不能滚出视口） */
.dshs-modal-foot{display:flex;justify-content:flex-end;align-items:center;gap:8px;flex:none;padding-top:10px;margin-top:10px;border-top:1px solid var(--line)}
.dshs-modal-foot .dshs-ibtn{margin-left:0;padding:6px 16px;font-size:12px}
.dshs-anno .act{display:flex;gap:6px;margin-top:7px}
.dshs-ds.expanded{display:block;-webkit-line-clamp:unset;min-height:auto}
.dshs-exp{font-size:10.5px;color:var(--brand1);cursor:pointer;white-space:nowrap;align-self:flex-start;margin-top:2px}
.dshs-src{font-size:10.5px;color:var(--brand1);text-decoration:none;white-space:nowrap}
.dshs-src:hover{text-decoration:underline}
.dshs-h{position:absolute;width:22px;height:22px;z-index:6}
.dshs-h.tl{left:0;top:0;cursor:nwse-resize}
.dshs-h.tr{right:0;top:0;cursor:nesw-resize}
.dshs-h.bl{left:0;bottom:0;cursor:nesw-resize}
.dshs-h.br{right:0;bottom:0;cursor:nwse-resize}
.dshs-h::after{content:'';position:absolute;width:10px;height:10px;border:0 solid var(--line)}
.dshs-h.br::after{right:2px;bottom:2px;border-right-width:2px;border-bottom-width:2px}
.dshs-h.bl::after{left:2px;bottom:2px;border-left-width:2px;border-bottom-width:2px}
.dshs-h.tr::after{right:2px;top:2px;border-right-width:2px;border-top-width:2px}
.dshs-h.tl::after{left:2px;top:2px;border-left-width:2px;border-top-width:2px}
.dshs-atabs{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap;flex:none}
.dshs-atabs button{font-size:11px;padding:3px 10px;border:1px solid var(--line);border-radius:7px;color:var(--tx2)}
.dshs-atabs button.on{border-color:var(--brand2);color:var(--brand2)}
.dshs-subnote{font-size:10.5px;color:var(--tx2);margin-top:6px;line-height:1.5}
`
