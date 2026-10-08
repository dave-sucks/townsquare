-- Product-facing names: the agents, and the engine's open questions (new
-- questions use the same wording, so a re-run still replaces its own).
UPDATE "agents" SET "name" = 'Post reader', "description" = 'Reads a post and lists every place it mentions, with what it says about each: an excerpt, dishes, a verdict and a score.' WHERE "key" = 'read';
UPDATE "agents" SET "name" = 'Place finder', "description" = 'Picks the Google listing a mentioned place refers to when the match isn''t clear.' WHERE "key" = 'resolve';
UPDATE "agents" SET "name" = 'Tagger', "description" = 'Tags a place from what one post says about it, quoting the evidence for each tag.' WHERE "key" = 'tag';
UPDATE "agents" SET "name" = 'Summary writer', "description" = 'Writes the summary and known-for dishes at the top of a place''s page.' WHERE "key" = 'summarize';

UPDATE "review_items" SET "question" = 'Couldn''t read this post cleanly. Check its places.'
  WHERE "status" = 'open' AND "question" = 'Read broke a rule twice; check what it got wrong.';
UPDATE "review_items" SET "question" = 'Couldn''t finish this post, even after retries.'
  WHERE "status" = 'open' AND "question" = 'The pipeline failed on this post after retries.';
UPDATE "review_items" SET "question" = regexp_replace("question", '^Read says this isn''t about a place, but it''s tagged at ', 'Not about a place? It''s tagged at ')
  WHERE "status" = 'open' AND "question" LIKE 'Read says this isn''t about a place%';
