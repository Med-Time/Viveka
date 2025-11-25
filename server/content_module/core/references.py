from typing import List, Dict, Any
from urllib.parse import urlparse
from datetime import datetime

from ddgs import DDGS  # make sure you have: pip install ddgs


def _domain_from_url(u: str) -> str:
    try:
        return urlparse(u).netloc
    except Exception:
        return ""


def find_references(text: str, top_k: int = 6, min_score: float = 1.0) -> List[Dict[str, Any]]:
    """
    Find candidate references for `text` using DDGS (DuckDuckGo / metasearch).

    Returns a list of dicts with at least:
      {
        "title": str,
        "url": str | None,
        "domain": str,
        "snippet": str,
        "source_type": "web",
        "verified": bool,
        "score": float,
      }

    Parameters:
    - top_k: max number of search results to consider
    - min_score: minimum score required to keep a result (results with score < min_score are discarded)
    """
    results: List[Dict[str, Any]] = []

    try:
        with DDGS() as ddgs:
            ddg_results = ddgs.text(text, max_results=top_k) or []

        # Each item is a dict like: {"title": ..., "href": ..., "body": ...}
        for i, r in enumerate(ddg_results[:top_k]):
            url = r.get("href") or r.get("url")
            title = r.get("title") or (url or "Reference")
            snippet = r.get("body") or r.get("snippet") or ""
            domain = _domain_from_url(url) if url else ""
            verified = bool(url and url.startswith("https://"))
            # simple score: higher for earlier results; add small boost for verified HTTPS links
            score = float(top_k - i)
            if verified:
                score += 0.5

            results.append(
                {
                    "title": title,
                    "url": url,
                    "domain": domain,
                    "snippet": snippet,
                    "source_type": "web",
                    "verified": verified,
                    "score": score,
                }
            )

    except Exception as e:
        # ddgs failed – log if needed, but don't crash caller
        print("DDGS search failed:", e)

    # Filter by min_score before deduplication/sorting
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
            "fetched_at": datetime.utcnow(),
        }
        out.append(r)
    return out


if __name__ == "__main__":
    sample = (
        "At its core, a computer network is a collection of computing devices that can "
        "communicate and share resources over wired (Ethernet) or wireless (Wi-Fi) links."
    )
    refs = find_references(sample, top_k=5)
    refs_enriched = enrich_and_verify(refs)
    from pprint import pprint
    pprint(refs_enriched)
