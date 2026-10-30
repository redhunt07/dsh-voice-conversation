# GitHub Packages

The public package linked to this repository is [@redhunt07/dsh-voice-conversation](https://github.com/users/redhunt07/packages/npm/package/dsh-voice-conversation), version **0.1.1**.

For a simple installation without GitHub registry authentication, use the public npm distribution:

```sh
dsh plugin --profile web add dsh-voice-conversation@0.1.1
```

To install specifically from GitHub Packages, configure the scope in your user npm configuration:

```sh
npm config set @redhunt07:registry https://npm.pkg.github.com
npm login --scope=@redhunt07 --auth-type=legacy --registry=https://npm.pkg.github.com
dsh plugin --profile web add @redhunt07/dsh-voice-conversation@0.1.1
```

GitHub's npm registry requires authentication even for public packages. Follow [GitHub's registry authentication instructions](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages), using a GitHub credential with read:packages access; an npmjs token is not a GitHub Packages credential. Never commit credentials to this repository.

The scoped distribution adjusts package.json, the DSH browser module registration and cordis.patch.yml together. Do not enable this distribution alongside the unscoped npm distribution or an older Voice Loop bundle, because they expose the same voice API routes.

Publication is performed by the Publish GitHub Package workflow with the repository's built-in GITHUB_TOKEN and packages:write permission. No personal npm or GitHub token is stored in the repository. Existing versions are verified and skipped rather than overwritten.
