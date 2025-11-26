from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from datetime import datetime
import os
import requests


def _domain_from_url(u: str) -> str:
    try:
        return urlparse(u).netloc
    except Exception:
        return ""


def find_references(
    text: str, 
    top_k: int = 6, 
    min_score: float = 5.0,
    title: Optional[str] = None,
    chapter_title: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Find candidate references for `text` using context-aware search.
    
    Strategy:
    1. Try Google Custom Search API (free tier, more accurate) with context query
    2. Fall back to DDGS with improved query formulation
    
    Parameters:
    - text: main content to find references for
    - top_k: max results to consider
    - min_score: minimum score threshold (default 5.0)
    - title: optional subtopic title for query context
    - chapter_title: optional chapter title for query context
    
    Returns: list of verified reference dicts with score >= min_score
    """
    results: List[Dict[str, Any]] = []
    
    # Build context-aware search query: prioritize specificity
    query_parts = []
    if chapter_title:
        query_parts.append(chapter_title)
    if title:
        query_parts.append(title)
    # Add first 100 chars of content for context
    if text:
        query_parts.append(text[100:100])
    
    search_query = " ".join(query_parts).strip()
    if not search_query:
        search_query = text  # fallback to full text
    
    # 1) Try Google Custom Search API (free tier supports 100 queries/day)
    google_key = os.getenv("GOOGLE_SEARCH_API_KEY")
    google_cx = os.getenv("GOOGLE_CX")
    
    if google_key and google_cx:
        results = _search_google(search_query, top_k, google_key, google_cx)
    
    # 2) Fall back to DDGS with context-aware query if Google unavailable or returned few results
    if not results or len(results) < (top_k // 2):
        ddgs_results = _search_ddgs(search_query, top_k)
        results.extend(ddgs_results)
    
    # Filter by min_score before dedup/sort
    if min_score is not None:
        results = [r for r in results if (r.get("score", 0.0) >= float(min_score))]
    
    # Deduplicate by url or title
    seen = set()
    dedup: List[Dict[str, Any]] = []
    for r in results:
        key = (r.get("url") or r.get("title") or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        dedup.append(r)
    
    # sort by score desc, cap at top_k
    dedup = sorted(dedup, key=lambda r: r.get("score", 0.0), reverse=True)[:top_k]
    return dedup


def _search_google(query: str, top_k: int, api_key: str, cx: str) -> List[Dict[str, Any]]:
    """
    Search using Google Custom Search API (free tier).
    Returns high-quality, context-relevant results.
    """
    results: List[Dict[str, Any]] = []
    try:
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "q": query,
            "key": api_key,
            "cx": cx,
            "num": min(top_k, 10),  # Google returns max 10 per request
        }
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            for i, item in enumerate(items[:top_k]):
                url_str = item.get("link")
                title = item.get("title", "")
                snippet = item.get("snippet", "")
                domain = _domain_from_url(url_str) if url_str else ""
                verified = bool(url_str and url_str.startswith("https://"))
                # Google results ranked by relevance, give higher scores to earlier results
                score = float(top_k - i) + (1.0 if verified else 0.0)
                
                results.append({
                    "title": title,
                    "url": url_str,
                    "domain": domain,
                    "snippet": snippet,
                    "source_type": "web",
                    "verified": verified,
                    "score": score,
                })
    except Exception as e:
        print(f"Google search failed: {e}")
    
    return results


def _search_ddgs(query: str, top_k: int) -> List[Dict[str, Any]]:
    """
    Fall back to DDGS (DuckDuckGo) with improved query formulation.
    """
    results: List[Dict[str, Any]] = []
    try:
        # Use ddgs.DDGS class directly
        from ddgs import DDGS as DDGSClient
        
        client = DDGSClient()
        ddg_results = client.text(query, max_results=top_k) or []
        
        for i, r in enumerate(ddg_results[:top_k]):
            url = r.get("href") or r.get("url")
            title = r.get("title") or (url or "Reference")
            snippet = r.get("body") or r.get("snippet") or ""
            domain = _domain_from_url(url) if url else ""
            verified = bool(url and url.startswith("https://"))
            # Score: higher for earlier results + bonus for HTTPS
            score = float(top_k - i) + (0.5 if verified else 0.0)
            
            results.append({
                "title": title,
                "url": url,
                "domain": domain,
                "snippet": snippet,
                "source_type": "web",
                "verified": verified,
                "score": score,
            })
    except Exception as e:
        print(f"DDGS search failed: {e}")

    
    return results


def enrich_and_verify(references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalize reference fields and attach fetched_at timestamp.
    """
    out: List[Dict[str, Any]] = []
    for ref in references:
        url = ref.get("url")
        domain = ref.get("domain") or (_domain_from_url(url) if url else "")
        r = {
            "title": ref.get("title") or (url or "Reference"),
            "url": url,
            "domain": domain,
            "snippet": ref.get("snippet") or "",
            "source_type": ref.get("source_type") or "web",
            "verified": bool(ref.get("verified") or (url and url.startswith("https://"))),
            "score": float(ref.get("score") or 0.0),
            "fetched_at": datetime.now(),
        }
        out.append(r)
    return out


if __name__ == "__main__":
    sample = (
        "Machine Learning Fundamentals for Professionals The Machine Learning Workflow "
    )
    refs = find_references(sample, top_k=5)
    refs_enriched = enrich_and_verify(refs)
    from pprint import pprint
    pprint(refs_enriched)
