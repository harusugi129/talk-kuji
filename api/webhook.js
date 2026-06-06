const { messagingApi, validateSignature } = require('@line/bot-sdk');
const getRawBody = require('raw-body');
const { Redis } = require('@upstash/redis');

// ====================================================
// ★ 設定エリア
// ====================================================

// 自分のLINEユーザーID
const MY_USER_ID = process.env.MY_USER_ID || '';

// 八百長モードを発動するトリガーワード
const TRIGGER_WORD = 'のぎざか';

// 八百長が続く回数
const RIGGED_COUNT = 5;

// くじコマンド
const TRIGGER_WORDS = ['くじ', 'くじを引く', 'クジ'];

// 全現役メンバー（2026年6月時点）
const ALL_MEMBERS = [
  '伊藤理々杏', '岩本蓮加', '吉田綾乃クリスティー', '遠藤さくら',
  '賀喜遥香', '金川紗耶', '黒見明香', '柴田柚菜', '田村真佑',
  '筒井あやめ', '林瑠奈', '弓木奈於', '五百城茉央', '池田瑛紗',
  '一ノ瀬美空', '井上和', '岡本姫奈', '小川彩', '奥田いろは',
  '川﨑桜', '菅原咲月', '冨里奈央', '中西アルノ', '愛宕心響',
  '大越ひなの', '小津玲奈', '海邉朱莉', '川端晃菜', '鈴木佑捺',
  '瀬戸口心月', '長嶋凛桜', '増田三莉音', '森平麗心', '矢田萌華',
];

// ハズレメンバー（他の人に出るメンバー）
const HAZURE_MEMBERS = [
  '吉田綾乃クリスティー',
  '伊藤理々杏',
  '黒見明香',
  '長嶋凛桜',
  '岡本姫奈',
  '冨里奈央',
  '矢田萌華',
];

// アタリメンバー = ハズレ以外の全員
const ATARI_MEMBERS = ALL_MEMBERS.filter(m => !HAZURE_MEMBERS.includes(m));

// ====================================================

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const REDIS_KEY = 'rigged_count';

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

  // トリガーワード → 八百長モード発動（返信なし・バレ防止）
  if (text === TRIGGER_WORD) {
    await redis.set(REDIS_KEY, RIGGED_COUNT, { ex: 1800 });
    return;
  }

  // くじコマンド
  if (TRIGGER_WORDS.includes(text)) {
    const count = await redis.get(REDIS_KEY);
    const riggedCount = count ? parseInt(count) : 0;

    let member;

    if (riggedCount > 0) {
      // 八百長モード
      if (userId === MY_USER_ID) {
        member = ATARI_MEMBERS[Math.floor(Math.random() * ATARI_MEMBERS.length)];
      } else {
        member = HAZURE_MEMBERS[Math.floor(Math.random() * HAZURE_MEMBERS.length)];
      }

      const newCount = riggedCount - 1;
      if (newCount > 0) {
        await redis.set(REDIS_KEY, newCount, { ex: 1800 });
      } else {
        await redis.del(REDIS_KEY);
      }
    } else {
      // 通常モード：全員公平にランダム
      member = ALL_MEMBERS[Math.floor(Math.random() * ALL_MEMBERS.length)];
    }

    return client.replyMessage({
      replyToken,
      messages: [buildFlexMessage(member)],
    });
  }
}

function buildFlexMessage(memberName) {
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
