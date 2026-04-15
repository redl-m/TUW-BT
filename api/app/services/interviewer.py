import json
import re
from typing import Dict, Tuple, List
from app.models.candidate import Candidate


class InterviewerService:
    def __init__(self, llm_manager):
        self.llm = llm_manager

    def _build_prompt(self, candidate: Candidate, user_weights: Dict[str, float]) -> list:
        # System instructions define the persona, constraints, and JSON requirement
        system_instruction = (
            "You are an expert technical recruiter and behavioral interviewer. Your objective is to help "
            "human recruiters verify AI-generated candidate scores by providing an executive summary and "
            "targeted, behavioral interview questions.\n\n"

            "### DEFINITIONS: ABSTRACT SOFT SKILLS\n"
            "The system evaluates candidates on the following abstract soft skills. You must understand their "
            "underlying meanings:\n"
            "- Structural Adherence: Capacity to thrive in established hierarchies, respect legacy constraints, "
            "and follow strict protocols.\n"
            "- Adaptive Fluidity: Ability to function without clear instructions, switch contexts rapidly, and accept "
            "undefined roles.\n"
            "- Interpersonal Influence: Capability to navigate complex social dynamics, persuade stakeholders, "
            "and drive alignment without direct authority.\n"
            "- Execution Velocity: Prioritization of speed and output over perfection or thoroughness (bias for "
            "action).\n"
            "- Psychological Resilience: Emotional stability to handle negative input, failure, isolation, or delayed "
            "rewards.\n\n"

            "### STRICT RULES & CONSTRAINTS\n\n"

            "SECTION 1: THE EXECUTIVE SUMMARY\n"
            "1. FOCUS ON THE CANDIDATE: The summary must strictly analyze the candidate's features and the AI's "
            "TreeSHAP attributions. \n"
            "2. SILENT FILTERING: Use the 'Recruiter Priorities' ONLY as an invisible filter to decide which "
            "candidate traits to highlight. NEVER summarize the recruiter's own settings back to them. \n"
            "   - BAD: 'The recruiter prioritized adaptive fluidity more heavily...'\n"
            "   - BAD: 'There is a discrepancy between the AI and your slider settings...'\n"
            "   - GOOD: 'The candidate exhibits low adaptive fluidity, which may present challenges in the fast-paced "
            "roles you are targeting.'\n"
            "3. TERMINOLOGY: You ARE permitted to use the exact names of the abstract soft skills in the summary.\n\n"

            "SECTION 2: THE INTERVIEW QUESTIONS\n"
            "4. NEVER CITE SOFT SKILLS BY NAME: When writing questions, you are strictly forbidden from using the exact"
            "labels of the soft skills (e.g., never say 'Execution Velocity' or 'Adaptive Fluidity'). You must "
            "translate"
            "these concepts into indirect, situational interview questions (e.g., STAR method).\n"
            "   - BAD: 'Given your low execution velocity score...'\n"
            "   - GOOD: 'Tell me about a time you had to deliver a project under a tight deadline. How did you balance "
            "speed with quality?'\n"
            "5. GENERATE 'ACTIONABLE' QUESTIONS: Base your questions directly on the features with the highest impact "
            "(TreeSHAP attributions) AND the features the recruiter marked as critical. Your questions must help the "
            "recruiter"
            "verify the *why* behind the AI's assessment in a real conversation.\n"
            "6. THE INFO FLAG: If the Info Flag is ACTIVE, at least one question MUST probe the discrepancy between the"
            "objective AI score and the recruiter's subjective score to uncover missing context.\n\n"

            "SECTION 3: OUTPUT FORMAT\n"
            "7. Your output must be a valid JSON object with exactly two keys: "
            "'executive_summary' (string, concise) and 'interview_questions' (list of strings, maximum of 3 questions)."
        )

        # User content maps to the data streams, formatting them for the LLM
        user_content = (
            f"[DATA STREAM 1: Candidate Profile]\n"
            f"{candidate.features.model_dump_json()}\n\n"
            f"[DATA STREAM 2: TreeSHAP Attributions (Algorithmic Logic)]\n"
            f"{json.dumps(candidate.shap_values, indent=2)}\n\n"
            f"[DATA STREAM 3: Recruiter Priorities (Dynamic Slider States)]\n"
            f"{json.dumps(user_weights, indent=2)}\n\n"
            f"[SYSTEM WARNING: Info Flag]\n"
            f"Status: {'ACTIVE - The objective AI score is significantly lower than the recruiter\'s subjective score.' if candidate.info_flag else 'INACTIVE'}"
        )

        return [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content}
        ]

    def generate_narrative(self, candidate: Candidate, user_weights: Dict[str, float]) -> Tuple[str, List[str]]:
        messages = self._build_prompt(candidate, user_weights)

        # Creative generation
        response_text = self.llm.generate(messages, max_tokens=768, temperature=0.6, do_sample=True)

        try:
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not match:
                raise ValueError("No valid JSON structure found.")
            result = json.loads(match.group(0))
            return result.get("executive_summary", ""), result.get("interview_questions", [])
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Narrative generation failed: {e}\nRaw output: {response_text}")
            return "Failed to generate summary.", ["Please review the candidate's profile manually."]