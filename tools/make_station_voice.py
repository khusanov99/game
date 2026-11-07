#!/usr/bin/env python3
"""Generates the metro station announcements with natural neural voices (Microsoft Edge TTS: Uzbek, English, Japanese).

Run on a computer with internet access:
    pip install edge-tts
    python3 tools/make_station_voice.py
It writes audio/stn/<lang>/<station index>.mp3 (30 small files). The game plays them automatically; where a file is missing it falls
back to the device's speech engine. You can also replace any file with your own recording (same name, mp3) for a real human voice.
"""
import asyncio, os
import edge_tts

VOICES = {"uz": "uz-UZ-MadinaNeural", "en": "en-US-JennyNeural", "ja": "ja-JP-NanamiNeural"}
NAMES = {
    "uz": ["Mustaqillik Maydoni", "Kosmonavtlar", "Alisher Navoiy", "Paxtakor", "Mirzo Ulug'bek", "Buyuk Ipak Yo'li", "Amir Temur Xiyoboni", "Ming O'rik", "Yunus Rajabiy", "Chorsu"],
    "en": ["Mustaqillik Maydoni", "Kosmonavtlar", "Alisher Navoiy", "Paxtakor", "Mirzo Ulugbek", "Buyuk Ipak Yo'li", "Amir Temur Khiyoboni", "Ming O'rik", "Yunus Rajabiy", "Chorsu"],
    "ja": ["ムスタキッリク広場", "コスモナフトラル", "アリシェル・ナヴォイ", "パフタコル", "ミルゾ・ウルグベク", "ブユク・イパク・ヨリ", "アミール・ティムール大通り", "ミン・ウリク", "ユヌス・ラジャビー", "チョルスー"],
}
LINE = {
    "uz": lambda n: f"Navbatdagi bekat: {n}. Ehtiyot bo'ling, eshiklar yopiladi.",
    "en": lambda n: f"Next station: {n}. Please stand clear of the closing doors.",
    "ja": lambda n: f"次は、{n}です。ドアが閉まります、ご注意ください。",
}


async def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio", "stn")
    for lg, voice in VOICES.items():
        os.makedirs(os.path.join(root, lg), exist_ok=True)
        for i, n in enumerate(NAMES[lg]):
            out = os.path.join(root, lg, f"{i}.mp3")
            await edge_tts.Communicate(LINE[lg](n), voice, rate="-8%").save(out)
            print("wrote", out)


asyncio.run(main())
