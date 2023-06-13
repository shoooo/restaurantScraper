const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);
const model = 'gpt-3.5-turbo';

async function searchKeywords(footer) {
    const prompt = `以下はある会社のウェブサイトのフッター部分のHTMLです。あなたはこの会社のメールアドレスを探そうとしています。メールアドレスが記載されてそうなページを探してそのページ名とそのリンクを3つを配列で出力してください。${footer}`;
    const response = await openai.createChatCompletion({
        model: model,
        messages: [{ role: "assistant", content: prompt }],
        max_tokens: 256,
        n: 1,
        stop: null,
        temperature: 1,
    });

    const keywords = response.data.choices[0].message.content
    return keywords
}

module.exports = { searchKeywords }