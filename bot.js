import 'dotenv/config';
import { Telegraf } from 'telegraf';
import ollama from 'ollama';
import axios from 'axios';

async function openRouterBackup(request) {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "z-ai/glm-4.5-air:free",
                "messages": [
                    {
                        "role": "user",
                        "content": request
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        const content = data.choices[0]?.message?.content;

        if (typeof content === 'string') {
            return content;
        } else {
            throw new Error('Ответ не содержит корректного текста');
        }
    } catch (error) {
        console.error('Ошибка при запросе к OpenRouter:', error);
        throw error;
    }
}

async function checkOllamaStatus() {
    try {
        const response = await axios.get('http://localhost:11434/api/version', { timeout: 3000 });
        if (response.status === 200) {
            return { ok: true, version: response.data.version };
        }
    } catch (error) {
        console.warn('Ollama не доступен:', error.message);
        return { ok: false, error: error.message };
    }
}

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Ну привет, это просто тест, бот который если мой комп включен отправляет твой запрос к локальной нейросети (она глупенькая, но это ничего), а если выключен, то в облако на OpenRouter, используя бесплатную GLM4 AIR'));

bot.on('message', async (ctx) => {
    // Проверяем, текстовое ли сообщение
    if (!ctx.message.text) {
        await ctx.reply(`Я умею работать только с текстом, хз чего ты ожидал, это же личный эксперемент`);
        await ctx.replyWithSticker('CAACAgIAAxkBAAMUaRsupnSO2_Pc5PYfhxUQawlkn9wAAvKHAAKLNnBL1CYUDAhbSjc2BA');
        return; // Прерываем выполнение
    }

    // Проверяем статус Ollama
    const ollamaStatus = await checkOllamaStatus();

    let aiResponse;
    if (ollamaStatus.ok) {
        // Используем Ollama
        const tempMsg = await ctx.reply('ща отвечу 👌, я медлено думаю, у моего хозяина нет денег на хорошие железки 😢');
        try {
            const response = await ollama.chat({
                model: 'qwen3:4b',
                messages: [{ role: 'user', content: ctx.message.text }],
            });
            aiResponse = response.message.content;
            await ctx.deleteMessage(tempMsg.message_id);
        } catch (error) {
            console.error('Ошибка при запросе к Ollama:', error);
            await ctx.deleteMessage(tempMsg.message_id);
            await ctx.reply('Произошла ошибка при запросе к Ollama.');
            return;
        }
    } else {
        // Используем OpenRouter
        await ctx.reply(`Кажется локальная оллама выключена, или компудахтер выключен, ниче, щас спрошу у GLM AIR, обожди чутка`);
        try {
            aiResponse = await openRouterBackup(ctx.message.text);
        } catch (error) {
            await ctx.reply('Произошла ошибка при запросе к OpenRouter.');
            return;
        }
    }

    // Отправляем ответ (только если он был получен)
    if (aiResponse) {
        await ctx.reply(aiResponse);
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));