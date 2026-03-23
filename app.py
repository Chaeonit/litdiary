"""
LinguaDiary - AI 언어 학습 일기 서비스
핵심 기술: OpenRouter API + Structured Output + Function Calling
"""

from flask import Flask, request, jsonify, render_template
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
import sqlite3
from datetime import datetime

load_dotenv()

app = Flask(__name__)

client = OpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

MODEL = "openai/gpt-4o-mini"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.getenv("DATABASE_URL")  # Render PostgreSQL
DB_FILE = os.path.join(BASE_DIR, "data", "diaries.db")  # 로컬 SQLite


# ─── DB 초기화 ──────────────────────────────────────────────────────────────

def init_db():
    if DATABASE_URL:
        import psycopg2
        url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(url)
        conn.cursor().execute('''
            CREATE TABLE IF NOT EXISTS diaries (
                id SERIAL PRIMARY KEY,
                date TEXT NOT NULL,
                language TEXT NOT NULL,
                text TEXT NOT NULL,
                analysis TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()
    else:
        os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
        conn = sqlite3.connect(DB_FILE)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS diaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                language TEXT NOT NULL,
                text TEXT NOT NULL,
                analysis TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

init_db()


# ─── 저장 유틸 ──────────────────────────────────────────────────────────────

def load_diaries():
    if DATABASE_URL:
        import psycopg2, psycopg2.extras
        url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(url)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM diaries ORDER BY id")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute("SELECT * FROM diaries ORDER BY id").fetchall()]
        conn.close()

    for r in rows:
        if isinstance(r["analysis"], str):
            r["analysis"] = json.loads(r["analysis"])
    return rows


def save_diary(date, language, text, analysis):
    analysis_str = json.dumps(analysis, ensure_ascii=False)
    if DATABASE_URL:
        import psycopg2
        url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO diaries (date, language, text, analysis) VALUES (%s, %s, %s, %s) RETURNING id",
            (date, language, text, analysis_str)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
    else:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.execute(
            "INSERT INTO diaries (date, language, text, analysis) VALUES (?, ?, ?, ?)",
            (date, language, text, analysis_str)
        )
        new_id = cur.lastrowid
        conn.commit()
        conn.close()
    return new_id


# ─── 라우트 ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    text = data.get("text", "").strip()
    language = data.get("language", "english")

    if not text:
        return jsonify({"error": "일기 내용을 입력해주세요."}), 400

    lang_name = "English" if language == "english" else "Chinese (Mandarin)"

    try:
        # STEP 1: Structured Output — 문법/어휘 분석
        analysis_schema = {
            "type": "object",
            "properties": {
                "corrected_text": {
                    "type": "string",
                    "description": "Full corrected version of the diary entry"
                },
                "errors": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "original":        {"type": "string"},
                            "corrected":       {"type": "string"},
                            "type":            {"type": "string", "enum": ["grammar", "vocabulary", "spelling", "punctuation"]},
                            "explanation_kr":  {"type": "string"}
                        },
                        "required": ["original", "corrected", "type", "explanation_kr"],
                        "additionalProperties": False
                    }
                },
                "score":               {"type": "integer"},
                "level":               {"type": "string", "enum": ["beginner", "intermediate", "advanced"]},
                "overall_feedback_kr": {"type": "string"}
            },
            "required": ["corrected_text", "errors", "score", "level", "overall_feedback_kr"],
            "additionalProperties": False
        }

        analysis_response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are an expert {lang_name} language tutor. "
                        "Analyze the user's diary entry for grammar, vocabulary, spelling, and punctuation errors. "
                        "Give a score from 0-100 based on accuracy and naturalness. "
                        "All explanations (explanation_kr, overall_feedback_kr) must be written in Korean."
                    )
                },
                {
                    "role": "user",
                    "content": f"Please analyze this {lang_name} diary entry:\n\n{text}"
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "diary_analysis",
                    "strict": True,
                    "schema": analysis_schema
                }
            }
        )

        analysis = json.loads(analysis_response.choices[0].message.content)

        # STEP 2: Function Calling — 퀴즈 & 관련 단어 생성
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "generate_fill_in_blank_quiz",
                    "description": (
                        "Generate fill-in-the-blank quiz questions to help the user practice "
                        "the grammar patterns and vocabulary from their diary entry errors."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "questions": {
                                "type": "array",
                                "description": "List of 3-4 quiz questions",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "sentence_with_blank": {
                                            "type": "string",
                                            "description": "A sentence with ___ marking the blank"
                                        },
                                        "answer": {
                                            "type": "string",
                                            "description": "The correct word or phrase for the blank"
                                        },
                                        "hint_kr": {
                                            "type": "string",
                                            "description": "A hint in Korean to help the user"
                                        }
                                    },
                                    "required": ["sentence_with_blank", "answer", "hint_kr"]
                                }
                            }
                        },
                        "required": ["questions"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "provide_related_vocabulary",
                    "description": (
                        "Provide related vocabulary words that the user should learn, "
                        "based on the topics and errors in their diary entry."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "words": {
                                "type": "array",
                                "description": "List of 4-5 vocabulary words to learn",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "word": {
                                            "type": "string",
                                            "description": "The vocabulary word"
                                        },
                                        "meaning_kr": {
                                            "type": "string",
                                            "description": "Korean meaning of the word"
                                        },
                                        "example_sentence": {
                                            "type": "string",
                                            "description": "An example sentence using the word"
                                        },
                                        "related_words": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "2-3 related words (synonyms or related expressions)"
                                        }
                                    },
                                    "required": ["word", "meaning_kr", "example_sentence", "related_words"]
                                }
                            }
                        },
                        "required": ["words"]
                    }
                }
            }
        ]

        errors_summary = json.dumps(analysis["errors"], ensure_ascii=False) if analysis["errors"] else "No major errors found."

        fc_response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a {lang_name} language tutor creating supplementary learning materials. "
                        "Call BOTH functions: generate a quiz AND provide vocabulary words. "
                        "Base them on the diary content and errors identified."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Diary entry:\n{text}\n\n"
                        f"Errors found:\n{errors_summary}\n\n"
                        "Please generate both a fill-in-the-blank quiz and related vocabulary for this student."
                    )
                }
            ],
            tools=tools,
            tool_choice="auto"
        )

        quiz = None
        vocabulary = None

        tool_calls = fc_response.choices[0].message.tool_calls or []
        for tool_call in tool_calls:
            args = json.loads(tool_call.function.arguments)
            if tool_call.function.name == "generate_fill_in_blank_quiz":
                quiz = args.get("questions", [])
            elif tool_call.function.name == "provide_related_vocabulary":
                vocabulary = args.get("words", [])

        return jsonify({
            "analysis": analysis,
            "quiz": quiz,
            "vocabulary": vocabulary
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/diaries", methods=["GET"])
def get_diaries():
    return jsonify(load_diaries())


@app.route("/diaries", methods=["POST"])
def save_diary_route():
    data = request.json
    date = datetime.now().strftime("%Y-%m-%d %H:%M")
    language = data.get("language")
    text = data.get("text")
    analysis = data.get("analysis")

    new_id = save_diary(date, language, text, analysis)
    entry = {"id": new_id, "date": date, "language": language, "text": text, "analysis": analysis}
    return jsonify({"success": True, "entry": entry})


if __name__ == "__main__":
    app.run(debug=True)
