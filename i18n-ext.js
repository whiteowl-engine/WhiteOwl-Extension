(function(){
'use strict';
var LANG_KEY='whiteowl_lang';
var savedLang=localStorage.getItem(LANG_KEY)||'en';
var translating=false;
var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,IFRAME:1,CANVAS:1,SVG:1,CODE:1,PRE:1};

var ZH={
"Token":"代币",
"Chat":"对话",
"Inspector":"检查器",
"Wallet":"钱包",
"Offline":"离线",
"Online":"在线",
"Connected":"已连接",
"Connecting...":"连接中…",

"Awaiting token signal":"等待代币信号",
"No token detected":"未检测到代币",
"Navigate to any token on pump.fun — analysis appears instantly.":"前往 pump.fun 上的任意代币页面 — 分析将即时显示。",
"Analyze":"分析",
"Rate":"评分",
"Search":"搜索",

"WhiteOwl Signal Desk":"WhiteOwl 信号台",
"Editorial command layer for live token context":"针对实时代币上下文的编辑指令层",
"Read flow, decode narratives and route fast intelligence without drowning the panel in noise.":"解读资金流、解码叙事、快速传递情报，不让面板淹没在噪声中。",
"Connect to WhiteOwl to start chatting":"连接 WhiteOwl 以开始对话",
"Trenches":"壕沟",
"Monitor":"监控",
"Trending":"热门",
"News":"新闻资讯",
"Portfolio":"投资组合",

"Context Inspector":"上下文检查器",
"Capture fragments, not clutter":"捕获关键片段，而非杂乱信息",
"Freeze the exact on-page signal you care about and pipe it into the desk with clean, minimal context.":"锁定页面上你关注的精确信号，以简洁的上下文传送到信号台。",
"Start Inspector":"启动检查器",
"Send All":"全部发送",
"Clear":"清除",
"Inspector active — click any element":"检查器已激活 — 点击任意元素",
"Stop":"停止",
"0 captured":"已捕获 0 个",
"No elements captured yet.":"尚未捕获任何元素。",

"Mainnet":"主网",
"Enter PIN":"输入 PIN",
"6-digit PIN to access your wallet":"输入6位 PIN 码以访问钱包",
"Forgot PIN · Reset":"忘记 PIN · 重置",
"Solana Wallet":"Solana 钱包",
"Choose how to get started":"选择开始方式",
"Generate with Seed Phrase":"通过助记词生成",
"Random address + 12-word recovery":"随机地址 + 12个单词恢复",
"Generate Wo-address":"生成 Wo 地址",
"Address starts with Wo (private key only)":"地址以 Wo 开头（仅限私钥）",
"Import Private Key":"导入私钥",
"Paste your base58 private key":"粘贴你的 base58 私钥",
"Burn Wallet":"燃烧钱包",
"Auto-approve all dApp requests (no popups)":"自动批准所有 dApp 请求（无弹窗）",
"Recover from Seed Phrase":"通过助记词恢复",
"12 or 24 words (BIP39)":"12 或 24 个单词（BIP39）",
"Multisig Vaults":"多签金库",
"M-of-N shared wallets (Squads v4)":"M-of-N 共享钱包（Squads v4）",
"Cancel":"取消",
"Import Wallet":"导入钱包",
"Recover Wallet":"恢复钱包",

"Reject":"拒绝",
"Approve":"批准",
"Send":"发送",
"Copy":"复制",
"Close":"关闭",
"Back":"返回",
"Refresh":"刷新",
"Loading...":"加载中…",
"Balance":"余额",
"Address":"地址",
"Settings":"设置",
"Deposit":"充值",
"Withdraw":"提现",
"Transactions":"交易记录",
"Network":"网络",
"Export Private Key":"导出私钥",
"Save":"保存",
"Delete":"删除",
"Confirm":"确认",
"Yes":"是",
"No":"否",
"OK":"确定",
"Error":"错误",
"Success":"成功",

"Prerequisite:":"前提条件：",
"Ready:":"就绪：",
"Connect to your Chrome browser first (remote debugging via CDP).":"请先连接你的 Chrome 浏览器（通过 CDP 远程调试）。",
"Connect to Chrome":"连接 Chrome",
"Chrome CDP active":"Chrome CDP 已激活",
"Not connected to any dApp":"未连接任何 dApp",
"No connected sites":"无已连接站点",
"Disconnect":"断开连接",
"Loading…":"加载中…",
"Failed to load":"加载失败",
"1 wallet":"1 个钱包",
"wallets":"个钱包",
"active":"已激活",
"No connections":"无连接",
"Vault Mode Active":"金库模式已激活",
"Exit Vault":"退出金库",
"Check RPC":"检查 RPC",
"Checking…":"检查中…",
"Balance:":"余额：",
"RPC URL is required":"请输入 RPC 地址",
"Must start with http(s)://":"地址必须以 http(s):// 开头",
"Swap":"兑换",
"Bridge":"桥接",
"Tokens":"代币",
"NFTs":"NFT",
"Activity":"活动",
"Best Price":"最优价格",
"Syncing wallet…":"正在同步钱包…",
"Loading address…":"加载地址中…",
"Preparing wallet":"准备钱包中",
"YOU RECEIVE":"你将收到",
"Slippage":"滑点",
"Confirm Swap":"确认兑换",
"Transaction Safety Check":"交易安全检查",
"Proceed":"继续",
"▲ Bullish":"▲ 看涨",
"▼ Bearish":"▼ 看跌",
"● Neutral":"● 中性"
};

var ZH_PH={
"Ask WhiteOwl anything...":"向 WhiteOwl 提问…",
"Enter base58-encoded private key...":"输入 base58 编码的私钥…",
"Wallet name (optional)":"钱包名称（可选）",
"Enter 12 or 24-word seed phrase, separated by spaces...":"输入12或24个单词的助记词，用空格分隔…"
};

var EN={};
Object.keys(ZH).forEach(function(k){EN[ZH[k]]=k;});
var EN_PH={};
Object.keys(ZH_PH).forEach(function(k){if(ZH_PH[k]!==k)EN_PH[ZH_PH[k]]=k;});

function translateNode(root,dict,phDict){
  if(!root||!root.nodeType)return;
  if(root.nodeType===3){
    var t=root.textContent.trim();
    if(t&&dict[t])root.textContent=root.textContent.replace(t,dict[t]);
    return;
  }
  if(root.nodeType!==1)return;
  if(SKIP[root.tagName])return;
  var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false);
  var node,nodes=[];
  while(node=walker.nextNode()){
    if(node.parentElement&&SKIP[node.parentElement.tagName])continue;
    nodes.push(node);
  }
  for(var i=0;i<nodes.length;i++){
    var txt=nodes[i].textContent.trim();
    if(!txt||/^[\d\$\.\,\%\-\+\:\s\/]+$/.test(txt))continue;
    if(dict[txt])nodes[i].textContent=nodes[i].textContent.replace(txt,dict[txt]);
  }
  var inputs=root.querySelectorAll('input[placeholder],textarea[placeholder]');
  for(var j=0;j<inputs.length;j++){
    var ph=inputs[j].getAttribute('placeholder');
    if(ph&&phDict[ph])inputs[j].setAttribute('placeholder',phDict[ph]);
  }
}

function translateAll(lang){
  if(translating)return;
  translating=true;
  try{
    var dict=lang==='zh'?ZH:EN;
    var phDict=lang==='zh'?ZH_PH:EN_PH;
    translateNode(document.body,dict,phDict);
    var btn=document.getElementById('wo-lang-toggle');
    if(btn)btn.textContent=lang==='zh'?'EN':'中文';
    savedLang=lang;
    localStorage.setItem(LANG_KEY,lang);
  }finally{translating=false;}
}

var observer;
function startObserver(){
  if(observer)return;
  observer=new MutationObserver(function(mutations){
    if(savedLang!=='zh'||translating)return;
    var added=[];
    for(var i=0;i<mutations.length;i++){
      var m=mutations[i];
      if(m.type==='childList'){
        for(var j=0;j<m.addedNodes.length;j++){
          var n=m.addedNodes[j];
          if(n.nodeType===1&&!SKIP[n.tagName])added.push(n);
          else if(n.nodeType===3){
            var t=n.textContent.trim();
            if(t&&ZH[t])n.textContent=n.textContent.replace(t,ZH[t]);
          }
        }
      }
    }
    if(added.length){
      clearTimeout(observer._t);
      var batch=added.slice();
      observer._t=setTimeout(function(){
        for(var k=0;k<batch.length;k++)translateNode(batch[k],ZH,ZH_PH);
      },60);
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
}

window.toggleExtLang=function(){
  translateAll(savedLang==='en'?'zh':'en');
};

function init(){
  startObserver();
  if(savedLang==='zh')setTimeout(function(){translateAll('zh');},100);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{init();}
})();
