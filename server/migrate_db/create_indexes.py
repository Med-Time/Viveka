from lesson_plan_module.core.mongo import sessions_col, lesson_plans_col
from core.mongo import content_col
from core.mongo import qa_col
from auth.core import users_collection

sessions_col.create_index("study_id", unique=True)
sessions_col.create_index("user_id")
content_col.create_index([("study_id", 1), ("chapter_idx", 1)])
lesson_plans_col.create_index("study_id")
qa_col.create_index("study_id")
users_collection().create_index("email", unique=True)