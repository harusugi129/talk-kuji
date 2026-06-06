const { messagingApi, validateSignature } = require('@line/bot-sdk');
const getRawBody = require('raw-body');

// ====================================================
// ★ 設定エリア - ここだけ編集してください
// ====================================================

// 自分のLINEユーザーID
// → グループで「マイID」と送ると確認できます（セットアップ時に使用）
const MY_USER_ID = process.env.MY_USER_ID || '';

// アタリメンバー（自分に出るメンバー）
const ATARI_MEMBER = '遠藤さくら';

// ハズレメンバーリスト（他の人に出るメンバー）
const HAZURE_MEMBERS = [
  '井上和',
  '五百城茉央',
  '小川彩',
  '奥田いろは',
  '池田瑛紗',
  '田村真佑',
  '弓木奈於',
];

// くじを引くコマンド（グループでこの言葉を送るとくじが引ける）
const TRIGGER_WORDS = ['くじ', 'くじを引く', 'クジ'];

// ====================================================
// ここから下は編集不要
// ====================================================

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).send('LINE Bot is running');
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req, { encoding: 'utf-8' });
  } catch {
    return res.status(400).send('Bad Request');
  }

  const signature = req.headers['x-line-signature'];
  if (!validateSignature(rawBody, process.env.CHANNEL_SECRET, signature)) {
    return res.status(403).send('Forbidden');
  }

  const body = JSON.parse(rawBody);

  try {
    await Promise.all((body.events || []).map(handleEvent));
  } catch (e) {
    console.error(e);
  }

  res.status(200).send('OK');
};

module.exports.config = {
  api: { bodyParser: false },
};

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text.trim();
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  // セットアップ用：自分のユーザーIDを確認するコマンド
  if (text === 'マイID') {
    return client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: `あなたのLINEユーザーID:\n${userId}` }],
    });
  }

  // くじコマンド
  if (TRIGGER_WORDS.includes(text)) {
    const isAtari = MY_USER_ID !== '' && userId === MY_USER_ID;
    const member = isAtari
      ? ATARI_MEMBER
      : HAZURE_MEMBERS[Math.floor(Math.random() * HAZURE_MEMBERS.length)];

    return client.replyMessage({
      replyToken,
      messages: [buildFlexMessage(isAtari, member)],
    });
  }
}

function buildFlexMessage(isAtari, memberName) {
  return {
    type: 'flex',
    altText: isAtari
      ? `🎉 アタリ！ ${memberName} のトーク権獲得！`
      : `😢 ハズレ... ${memberName} でした`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        backgroundColor: isAtari ? '#3d0066' : '#1a1a2e',
        contents: [
          {
            type: 'text',
            text: '🎫 乃木坂46 トーク権くじ',
            color: '#c9a0d8',
            size: 'sm',
            align: 'center',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '24px',
        backgroundColor: isAtari ? '#1a0533' : '#0d0d1a',
        contents: [
          {
            type: 'text',
            text: isAtari ? '🎉 アタリ！' : '😢 ハズレ...',
            weight: 'bold',
            size: 'xxl',
            color: isAtari ? '#ffd700' : '#666666',
            align: 'center',
          },
          {
            type: 'text',
            text: memberName,
            weight: 'bold',
            size: 'xxl',
            color: isAtari ? '#f9c0d0' : '#888888',
            align: 'center',
            margin: 'md',
          },
          {
            type: 'text',
            text: isAtari ? 'トーク権 獲得！🌸' : 'また今度！',
            size: 'sm',
            color: isAtari ? '#d4a0e0' : '#555555',
            align: 'center',
            margin: 'sm',
          },
        ],
      },
    },
  };
}
