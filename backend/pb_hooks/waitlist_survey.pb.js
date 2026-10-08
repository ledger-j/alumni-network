/// <reference path="../pb_data/types.d.ts" />
// UniCircle waitlist survey: GDPR erasure follow-through.
// Lives next to waitlist.pb.js in /opt/unicircle/pb_hooks (mounted at /pb/pb_hooks).
//
// The optional post-signup answers live in their own collection (waitlist_survey),
// linked to the sign-up by email. When a waitlist row is deleted (one-click
// unsubscribe, or a superuser deleting it in the admin UI), the answers for that
// email go too, so nothing about the person is left behind.
//
// Never throws: a failure here is logged and must not turn a finished erasure of
// the waitlist row into an error page. Logs ids and counts only, never the email.
onRecordAfterDeleteSuccess((e) => {
  try {
    const email = String(e.record.get("email") || "").toLowerCase();
    if (email) {
      const rows = e.app.findRecordsByFilter(
        "waitlist_survey", "email:lower = {:email}", "", 0, 0, { email: email }
      );
      let gone = 0;
      for (const row of rows) {
        try {
          e.app.delete(row);
          gone++;
        } catch (err) {
          console.log("[waitlist_survey] delete FAILED · survey " + row.id + " · " + err);
        }
      }
      if (rows.length) {
        console.log("[waitlist_survey] waitlist " + e.record.id + " deleted · removed " + gone + "/" + rows.length + " survey row(s)");
      }
    }
  } catch (err) {
    console.log("[waitlist_survey] erasure follow-through FAILED · waitlist " + e.record.id + " · " + err);
  }
  e.next();
}, "waitlist");
