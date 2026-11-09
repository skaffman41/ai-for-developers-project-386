# Automatic tests

After completing all the steps in the project, automatic tests will become available to you. Tests are run on each commit - once all tasks in the Hexlet interface are completed, make a commit, and the tests will run automatically.

The hexlet-check.yml file is responsible for running these tests - do not delete this file, edit it, or rename the repository.

The app-check.yml workflow runs `mise run check` on push, pull request, and explicit Release PR dispatch. Release dispatch verifies its expected head SHA before checkout and again after check. The agent workflow acceptance evidence is recorded in [workflow-verification.md](../../docs/agents/workflow-verification.md).

The release-please.yml workflow maintains one Release PR on main and creates its tag/GitHub Release after manual merge. It uses GITHUB_TOKEN and explicitly dispatches app-check for each created or updated PR. Configuration, permissions, local dry-run, and the separately authorized publication procedure are documented in [releasing.md](../../docs/releasing.md).
