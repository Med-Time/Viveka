# server/assistant_module/assistant_llm.py
import os, json, textwrap
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    raise ValueError("Set GOOGLE_API_KEY in your .env")

MODEL_NAME = "gemini-2.0-flash" 
MAX_REF_CHARS = 15000

SYSTEM_INSTRUCTION = textwrap.dedent("""\
You are LearnBot, a friendly and helpful AI tutor. Your tone is encouraging, supportive, and very human-like.

**CRITICAL RULES FOR YOUR RESPONSE:**
1.  **NO MARKDOWN, EVER.** Your *entire* reply must be 100% plain text. Do NOT use **bold**, *italics*, bullet points, numbered lists, headings, or code fences.
2.  **BE SHORT AND CONVERSATIONAL.** Be short and crisp: MAXIMUM 3 short sentences and ideally under ~35 words. Write like you're speaking to a student, not like an encyclopedia.
3.  **DO NOT COPY THE REFERENCE'S STYLE.** The reference material provided to you may be formal and use markdown. You MUST ignore that style. Use the reference *only* for facts.
4.  **NO LABELS.** Do not use labels like "Random Component:" or similar. Just write in normal, flowing paragraphs.
""")

# Instantiate LangChain Google GenAI chat model
llm = ChatGoogleGenerativeAI(api_key=API_KEY, model=MODEL_NAME, system_message=SYSTEM_INSTRUCTION)

# Create a reusable prompt template
prompt_template = PromptTemplate(
    input_variables=["reference", "user_request"],
    template="""
REFERENCE:
{reference}

USER_REQUEST:
{user_request}

INSTRUCTIONS:
- Answer the user's request based on the reference.
- Remember all your rules: be short, conversational, and use **NO markdown**.
"""
)

chain = LLMChain(llm=llm, prompt=prompt_template)

def build_dynamic_reference(persona: dict, subtopic_md: str, max_chars=MAX_REF_CHARS):
    """
    Builds the reference string from dynamic data.
    """
    persona_str = json.dumps(persona, indent=2, ensure_ascii=False)
    ref = "\n".join([
        "REFERENCE_START",
        "PERSONA_JSON:",
        persona_str,
        "",
        "CONTENT_MD_START:",
        subtopic_md,
        "CONTENT_MD_END",
        "REFERENCE_END"
    ])
    if len(ref) > max_chars:
        ref = ref[:max_chars-200] + "\n\n[REFERENCE TRUNCATED]"
    return ref

async def get_assistant_response(persona: dict, subtopic_md: str, user_message: str) -> str:
    """
    Main function to get a response from the LLM, using dynamic context.
    """
    reference = build_dynamic_reference(persona, subtopic_md)
    
    # Use .arun for async execution with FastAPI
    try:
        resp = await chain.arun({"reference": reference, "user_request": user_message})
        return resp
    except Exception as e:
        print(f"Error in LLM chain execution: {e}")
        return "I'm sorry, I encountered an error trying to process that."

# Your old test code can remain here for independent testing
if __name__ == "__main__":
    import asyncio

    async def test_run():
        print("LearnBot (LangChain) ready. Type 'quit' to exit.")
        
        # Mock data for testing
        test_persona = {"name": "Test User", "learning_goal": "Understand Python"}
        test_content = "# Python Basics\n\nVariables are containers."
        
        while True:
            q = input("You: ")
            if q.strip().lower() in ("quit","exit"):
                break
            
            resp = await get_assistant_response(test_persona, test_content, q)
            print("\nLearnBot:\n", resp, "\n")
    
    asyncio.run(test_run())

# import os, json, textwrap
# from dotenv import load_dotenv
# from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain.prompts import PromptTemplate
# from langchain.chains import LLMChain
# from content_module.services.content_generator import fetch_persona_and_lesson
# from 

# load_dotenv()
# API_KEY = os.getenv("GOOGLE_API_KEY")
# if not API_KEY:
#     raise ValueError("Set GOOGLE_API_KEY in your .env")

# MODEL_NAME = "gemini-2.0-flash"
# MAX_REF_CHARS = 15000

# PERSONA_PATH = "C:/Viveka/server/assistant_module/user_persona.json"
# MD_PATH = "C:/Viveka/server/assistant_module/subtopic_content.md"

# def read_json(path):
#     with open(path, "r", encoding="utf-8") as f:
#         return json.load(f)

# def read_md(path):
#     with open(path, "r", encoding="utf-8") as f:
#         return f.read()

# def build_simple_reference(persona_path, md_path, max_chars=MAX_REF_CHARS):
#     persona = read_json(persona_path)
#     md = read_md(md_path)
#     persona_str = json.dumps(persona, indent=2, ensure_ascii=False)
#     ref = "\n".join([
#         "REFERENCE_START",
#         "PERSONA_JSON:",
#         persona_str,
#         "",
#         "CONTENT_MD_START:",
#         md,
#         "CONTENT_MD_END",
#         "REFERENCE_END"
#     ])
#     if len(ref) > max_chars:
#         ref = ref[:max_chars-200] + "\n\n[REFERENCE TRUNCATED]"
#     return ref

# SYSTEM_INSTRUCTION = textwrap.dedent("""\
# You are LearnBot — a friendly, encouraging, and helpful AI tutor assistant specialized for individualized learning.
# Rules:
# - Use the REFERENCE (persona + content) as the primary personalization source.
# - Keep answers clear and actionable; provide 1-2 practice examples when appropriate.
# """)

# # Instantiate LangChain Google GenAI chat model
# llm = ChatGoogleGenerativeAI(api_key=API_KEY, model=MODEL_NAME, system_message=SYSTEM_INSTRUCTION)

# # Create a reusable prompt template
# prompt_template = PromptTemplate(
#     input_variables=["reference", "user_request"],
#     template="""
# REFERENCE:
# {reference}

# USER_REQUEST:
# {user_request}

# INSTRUCTIONS:
# - Use the REFERENCE where relevant. Mention in one sentence which persona points you used.
# """
# )

# chain = LLMChain(llm=llm, prompt=prompt_template)

# def ask_with_files_langchain(user_message):
#     reference = build_simple_reference(PERSONA_PATH, MD_PATH)
#     resp = chain.run({"reference": reference, "user_request": user_message})
#     return resp

# if __name__ == "__main__":
#     print("LearnBot (LangChain) ready. Type 'quit' to exit.")
#     while True:
#         q = input("You: ")
#         if q.strip().lower() in ("quit","exit"):
#             break
#         print("\nLearnBot:\n", ask_with_files_langchain(q), "\n")
