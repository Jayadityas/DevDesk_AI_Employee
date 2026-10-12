# Publish the submission and keep it updated

Edit the application in the original `C:\AI_employee` workspace. The generated submission checkout is `C:\AI_employee\var\github-submission`; it contains the reviewed source package, playground Git bundle and selected noncredential evidence. This keeps local database/configuration/evidence/build directories outside publication and preserves the existing nested playground repository.

## First push

1. Sign into your GitHub account and create a repository named `DevDesk`. Use Public if submission reviewers must open it without invitations, or Private with reviewer access. Leave README, .gitignore and licence initialization unchecked. Copy its HTTPS URL.
2. Run the following in PowerShell. Replace name/email and repository URL with yours. Use the GitHub-provided noreply email if you prefer to keep your email out of commit metadata. Local config affects this submission only; global Git identity remains untouched.

```powershell
cd C:\AI_employee
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Sync-GitHubSubmission.ps1
cd .\var\github-submission
git init -b main
git config user.name "YOUR NAME"
git config user.email "YOUR GITHUB EMAIL OR NOREPLY EMAIL"
git add .
git status --short
git commit -m "Submit DevDesk implementation and verification"
git remote add origin https://github.com/YOUR_USERNAME/DevDesk.git
git push -u origin main
```

Authenticate through Git's normal GitHub sign-in/credential manager when prompted. Never paste a key/token into chat or embed it in the remote URL. If this machine cannot present interactive sign-in, run the push in your own terminal. Avoid force push if the remote already contains commits; inspect/reconcile instead.

After a successful push, the submission URL is `https://github.com/YOUR_USERNAME/DevDesk`. Check that README, devdesk source, docs and distribution files are visible and no local account/config/database files appear. A reviewer can clone this repo and follow SETUP_AND_DEMO; the bootstrap restores playground source/history from its bundle. This is source publication, separate from the future automated DevDesk PR/reviewer/admin connector.

## Future changes

Make changes in the original workspace. If you changed the separate playground repository, commit those changes there first; the package exports Git history and refuses dirty fixture worktrees. Control-plane/tool/doc edits are copied directly from original source.

```powershell
cd C:\AI_employee
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Sync-GitHubSubmission.ps1
git -C .\var\github-submission diff --stat
git -C .\var\github-submission add .
git -C .\var\github-submission commit -m "Describe your changes"
git -C .\var\github-submission push
```

You set the remote/upstream only on the first push. The sync script preserves the submission's .git and refuses to overwrite uncommitted submission edits. Removed generated files are removed only inside the owned submission directory, so deletions can be reviewed in Git too. If you edit the generated submission directly, commit/reconcile it before syncing; the original workspace remains canonical.

Official command reference: [GitHub: adding locally hosted code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
