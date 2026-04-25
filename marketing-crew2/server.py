import os
import re
import json
import requests
from flask import Flask, request, jsonify, session, redirect
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_secret_key_123")
# Enable credentials to allow session cookies to be sent from frontend
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173", 
    "http://localhost:5174", 
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177"
])

# In-memory token storage (In production, use a database)
TOKENS = {
    "linkedin": None
}

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

EXTRA_HEADERS = {
    "HTTP-Referer": "http://localhost",
    "X-Title": "Marketing Crew Project",
}

MODELS = [
    "qwen/qwen3-30b-a3b",
    "qwen/qwen3-8b",
    "meta-llama/llama-3.3-70b-instruct:free",
]

# --- OAUTH CONFIG ---
LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI")

def build_prompt(product_name, product_description, target_audience, budget):
    current_date = datetime.now().strftime("%Y-%m-%d")
    return f"""You are a marketing AI team.

**Product**: {product_name}
**Description**: {product_description}
**Target Audience**: {target_audience}
**Budget**: {budget}
**Today's Date**: {current_date}

Return ALL of the following. Format everything clearly in markdown with proper headings.

## 1. Market Research

- Key market trends relevant to this product.
- Target audience demographics, pain points, and buying behavior.
- 3-5 competitors and their positioning.
- Opportunities and threats.

---

## 2. Marketing Strategy

- Brand positioning and unique value proposition (UVP).
- 3-4 SMART marketing goals.
- Recommended channels with budget allocation from {budget}.
- 30-day high-level action plan.

---

## 3. Content Calendar (Next 2 Weeks)

Create a table:
| Day | Platform | Content Type | Topic/Hook | CTA |

Include at least 10 entries across Instagram, Twitter/X, LinkedIn, Blog.

---

## 4. Three Social Media Posts (Ready to Publish)

### Post 1 - Twitter/X
- Under 280 characters with hashtags.

### Post 2 - Instagram Caption
- Engaging caption with emojis, CTA, and 10-15 hashtags.

### Post 3 - LinkedIn Post
- Professional tone with hook, value, and CTA.

---

## 5. Blog Draft with SEO Keywords

Write a blog post (800-1000 words):
- SEO-optimized title
- 10 target SEO keywords listed at top
- Proper heading structure (H1, H2, H3)
- Engaging introduction
- 3-4 body sections
- Conclusion with CTA
- Meta description (under 160 characters)

---

Be specific, actionable, and creative.
"""


def parse_sections(markdown_text):
    sections = {
        "market_research": "",
        "strategy": "",
        "content_calendar": "",
        "social_posts": "",
        "blog_draft": "",
    }

    hr_pattern = r'^\s*(?:---+|\*\*\*+|___+)\s*$'
    blocks = re.split(hr_pattern, markdown_text, flags=re.MULTILINE)

    if len([b for b in blocks if b.strip()]) < 3:
        heading_pattern = r'(?=^#{1,3}\s*\d+[\.\):]?\s)'
        blocks = re.split(heading_pattern, markdown_text, flags=re.MULTILINE)

    section_rules = [
        ("content_calendar", ["content calendar", "editorial calendar"]),
        ("social_posts", ["social media post", "social post", "ready to publish",
                          "three social", "3 social", "twitter/x", "instagram caption"]),
        ("blog_draft", ["blog draft", "blog post", "seo keyword", "seo-optimized",
                        "meta description"]),
        ("market_research", ["market research", "market trend", "competitor",
                             "target audience demographic", "opportunities and threats"]),
        ("strategy", ["marketing strategy", "brand positioning", "smart goal",
                      "action plan", "budget allocation", "value proposition"]),
    ]

    for block in blocks:
        stripped = block.strip()
        if not stripped:
            continue
        header = stripped[:400].lower()
        matched_key = None
        for key, keywords in section_rules:
            if any(kw in header for kw in keywords):
                matched_key = key
                break
        if matched_key and not sections[matched_key]:
            sections[matched_key] = stripped

    return sections


def call_model(messages):
    for model in MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                extra_headers=EXTRA_HEADERS,
            )
            return response.choices[0].message.content, model
        except Exception as e:
            print(f"Model {model} failed: {str(e)[:200]}")
            continue
    return None, None


@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.json
    product_name = data.get("product_name", "")
    product_description = data.get("product_description", "")
    target_audience = data.get("target_audience", "")
    budget = data.get("budget", "")

    if not product_name:
        return jsonify({"error": "product_name is required"}), 400

    prompt = build_prompt(product_name, product_description, target_audience, budget)
    raw_output, used_model = call_model([{"role": "user", "content": prompt}])

    if raw_output is None:
        return jsonify({"error": "All models failed. Try again later."}), 503

    sections = parse_sections(raw_output)

    os.makedirs("output", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"output/marketing_output_{timestamp}.md"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"# Marketing Package - {product_name}\n")
        f.write(f"_Generated on {datetime.now().strftime('%Y-%m-%d')}_\n\n")
        f.write(raw_output)

    return jsonify({
        "status": "success",
        "model": used_model,
        "sections": sections,
        "raw": raw_output,
        "saved_to": output_file,
    })


@app.route("/api/regenerate-section", methods=["POST"])
def regenerate_section():
    data = request.json
    section_key = data.get("section_key", "")
    current_content = data.get("current_content", "")
    instructions = data.get("instructions", "")
    product_name = data.get("product_name", "")
    target_audience = data.get("target_audience", "")

    section_labels = {
        "market_research": "Market Research",
        "strategy": "Marketing Strategy",
        "content_calendar": "Content Calendar",
        "social_posts": "Social Media Posts",
        "blog_draft": "Blog Draft with SEO Keywords",
    }

    label = section_labels.get(section_key, section_key)

    if not section_key or not current_content:
        return jsonify({"error": "section_key and current_content are required"}), 400

    prompt = f"""You are a marketing AI assistant. The user has a "{label}" section for their product "{product_name}" (target audience: {target_audience}).

Here is the current content:

---
{current_content}
---

The user wants you to improve this section. Their instructions:
"{instructions if instructions else 'Make it better, more specific, and more actionable.'}"

Rewrite ONLY this section. Return the improved markdown content directly (no preamble, no extra commentary). Keep the same general structure but improve based on the user's feedback."""

    new_content, used_model = call_model([{"role": "user", "content": prompt}])

    if new_content is None:
        return jsonify({"error": "All models failed. Try again later."}), 503

    return jsonify({
        "status": "success",
        "section_key": section_key,
        "new_content": new_content,
        "model": used_model,
    })

# --- SOCIAL MEDIA API ENDPOINTS ---

@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    return jsonify({
        "linkedin": TOKENS["linkedin"] is not None
    })

# -- LinkedIn OAuth 2.0 --
@app.route("/api/auth/linkedin", methods=["GET"])
def auth_linkedin():
    if not LINKEDIN_CLIENT_ID:
        return jsonify({"error": "LinkedIn Client ID not configured"}), 500
        
    auth_url = (
        f"https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code&client_id={LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={LINKEDIN_REDIRECT_URI}&scope=w_member_social%20openid%20profile%20email"
    )
    return jsonify({"url": auth_url})

@app.route("/api/auth/callback/linkedin", methods=["GET"])
def linkedin_callback():
    code = request.args.get("code")
    if not code:
        return "Error: No code provided", 400
    
    token_url = "https://www.linkedin.com/oauth/v2/accessToken"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "client_id": LINKEDIN_CLIENT_ID,
        "client_secret": LINKEDIN_CLIENT_SECRET
    }
    response = requests.post(token_url, data=data)
    token = response.json()
    
    if "access_token" not in token:
        return f"Error fetching token: {token.get('error_description', 'Unknown error')}", 500

    # Get user URN (required for posting)
    user_info = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {token['access_token']}"}
    ).json()
    
    token["user_urn"] = f"urn:li:person:{user_info['sub']}"
    TOKENS["linkedin"] = token
    return "LinkedIn connected! You can close this window."

@app.route("/api/auth/linkedin/disconnect", methods=["POST"])
def disconnect_linkedin():
    TOKENS["linkedin"] = None
    return jsonify({"status": "success"})

# -- Posting Endpoints --

@app.route("/api/post/linkedin", methods=["POST"])
def post_linkedin():
    if not TOKENS["linkedin"]:
        return jsonify({"error": "LinkedIn not connected"}), 401
    
    content = request.json.get("content", "")
    if not content:
        return jsonify({"error": "No content provided"}), 400
    
    # Extract only LinkedIn part from social_posts content
    # In a real app, you'd parse the markdown more carefully
    linkedin_content = content
    if "Post 3 - LinkedIn Post" in content:
        linkedin_content = content.split("Post 3 - LinkedIn Post")[-1].strip()
    
    token = TOKENS["linkedin"]
    url = "https://api.linkedin.com/v2/ugcPosts"
    headers = {
        "Authorization": f"Bearer {token['access_token']}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    payload = {
        "author": token["user_urn"],
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": linkedin_content},
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
    }
    
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 201:
        return jsonify({"status": "success"})
    else:
        return jsonify({"error": response.text}), response.status_code

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
