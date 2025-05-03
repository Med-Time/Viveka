from pydantic import BaseModel

class InterviewStartInput(BaseModel):
    user_id: str
    subject: str
    goal: str
    level: str

class AnswerInput(BaseModel):
    user_id: str
    answer: str
