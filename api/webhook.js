const { messagingApi, validateSignature } = require('@line/bot-sdk');
const getRawBody = require('raw-body');

// ====================================================
// ★ 設定エリア - ここだけ編集してください
// ====================================================

// 自分のLINEユーザーID
// → グループで「マイID」と送ると確認できます（セットアップ時に使用）
const MY_USER_ID = process.env.MY_USER_ID || '';

// アタリメンバー（自分に出るメンバー）※複数指定するとランダムで選ばれる
const ATARI_MEMBERS = [
  '遠藤さくら',
  '賀喜遥香',
  '筒井あやめ',
  '池田瑛紗',
  '井上和',
];

// ハズレメンバーリスト（他の人に出るメンバー）
const HAZURE_MEMBERS = [
  '吉田綾乃クリスティー',
  '伊藤りりあ',
  '黒見明香',
  '長嶋りな',
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
      ? ATARI_MEMBERS[Math.floor(Math.random() * ATARI_MEMBERS.length)]
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
    altText: `結果：${memberName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '24px',
        backgroundColor: '#1a0533',
        contents: [
          {
            type: 'text',
            text: '乃木坂46 トーク権くじ',
            color: '#c9a0d8',
            size: 'sm',
            align: 'center',
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#3d0066',
          },
          {
            type: 'text',
            text: memberName,
            weight: 'bold',
            size: 'xxl',
            color: '#f9c0d0',
            align: 'center',
            margin: 'lg',
          },
        ],
      },
    },
  };
}
