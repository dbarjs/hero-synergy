# Which signals tell the extension host it runs in an isolated environment?

Research for [#125](https://github.com/dbarjs/hero-synergy/issues/125), part of map [#123](https://github.com/dbarjs/hero-synergy/issues/123). Read on 2026-10-09 against VS Code 1.141.0 (server commit `2a59476`), `microsoft/vscode` at `dd036a1`, Dev Containers 0.470.0, Remote - SSH 0.129, Remote - WSL 0.104.3, Remote - Tunnels (`ms-vscode.remote-server`) 1.6, GitHub Codespaces 1.18.16.

Claims marked **documented** come from vendor docs; **source** means read in vendor source or in the shipped extension bundle (the remote extensions are closed source, so "source" for them means the minified `extension.js` inside the Marketplace VSIX); **observed** means measured in this devcontainer; **inferred** is my reading.

## Answer

1. **`vscode.env.remoteName` is the strongest signal.** It is the prefix of the remote authority, chosen by the resolver extension the user installed. A repository cannot set it. The container-backed values are `dev-container`, `attached-container`, `k8s-container`, `apple-container` (all from Dev Containers) and `codespaces`. `wsl`, `ssh-remote` and `tunnel` say nothing about isolation. `undefined` means a local window.
2. **Marker files are the second signal.** `/.dockerenv` (Docker/Moby) and `/run/.containerenv` (Podman) are created by the container engine. A repository cannot create them on a host, and an unprivileged user cannot create them at `/`. They catch the cases `remoteName` misses: Gitpod/Ona and any SSH or tunnel target that is itself a container, and VS Code server running directly in a container.
3. **Environment variables are hints, not proof.** Every variable in the extension host can be added by the user's shell profile, because VS Code and Dev Containers both copy the login shell's environment into the extension host. Use them to name the environment, not to decide that it is isolated.
4. **A repository can't make a non-isolated machine look isolated** through `.vscode/settings.json` or `devcontainer.json`. The one path is `.envrc` through direnv, and only when the user runs `code .` from a shell where direnv already loaded it (the CLI's environment is passed to the new window).
5. **"Container" is not the same as "sandbox".** A repo's `devcontainer.json` decides the mounts, `--privileged`, `runArgs` and whether the Docker socket goes in. A `dev-container` window can still have write access to the host's home or Docker daemon. Detection answers "is this a container or a cloud VM", not "is it safe". That fits the map's plan to put the decision in the user's machine-scoped setting.

Suggested rule for the pure function in core (inferred):

```
isolated =
  remoteName ∈ {dev-container, attached-container, k8s-container, apple-container, codespaces}
  || exists(/.dockerenv) || exists(/run/.containerenv)
```

Environment variables (`REMOTE_CONTAINERS`, `CODESPACES`, `GITPOD_WORKSPACE_ID`, `container`) only label which environment was found, for the health message. `wsl`, `ssh-remote`, `tunnel` and `undefined` count as isolated only when a marker file is present. Hero Synergy's `extensionKind` is `["workspace"]` (`packages/vscode/package.json`), so its file checks and `process.env` reads run on the remote side, which is the machine that matters.

## The signals

| Signal | Set by | Meaning | Reaches the extension host | Spoofable by a repo | Spoofable by a shell profile | Value here |
|---|---|---|---|---|---|---|
| `env.remoteName` = `dev-container` | Dev Containers resolver | Window opened in a container that Dev Containers built or started from `devcontainer.json` | Yes, it is an API value in every host | No | No | `dev-container` (inferred from `REMOTE_CONTAINERS=true` in the host; the API value itself was not read from inside an extension) |
| `attached-container` | Dev Containers resolver | Attached to an already-running container | Yes | No | No | — |
| `k8s-container` | Dev Containers resolver | Attached to a Kubernetes pod container | Yes | No | No | — |
| `apple-container` | Dev Containers resolver | Apple `container` runtime (one VM per container on macOS) | Yes | No | No | — |
| `codespaces` | GitHub Codespaces resolver | Codespace (cloud VM running a dev container) | Yes | No | No | — |
| `wsl` / `ssh-remote` / `tunnel` | WSL / Remote - SSH / Remote - Tunnels resolvers | A remote machine; isolation unknown (Gitpod/Ona connect through `ssh-remote`) | Yes | No | No | — |
| `undefined` | VS Code | Local window | Yes | No | No | — |
| `REMOTE_CONTAINERS=true` | Dev Containers, in the resolver's `extensionHostEnv` and in lifecycle commands | Dev Containers session | Yes (observed) | Only inside a container already (`remoteEnv` can override it) or via `.envrc` + `code .` locally | Yes (adds it on any machine) | `true` |
| `REMOTE_CONTAINERS_IPC`, `REMOTE_CONTAINERS_SOCKETS` | Dev Containers | Socket paths for the session | Yes (observed) | Same as above | Yes | `/tmp/vscode-remote-containers-ipc-<uuid>.sock`, `["/tmp/vscode-ssh-auth-<uuid>.sock"]` |
| `VSCODE_REMOTE_CONTAINERS_SESSION` | Dev Containers, on the keep-alive `docker exec` shell and port-forward helpers only | Lets Dev Containers find its own processes | **No** (observed absent) | n/a | Yes | absent from the host; present on the keep-alive `/bin/sh` and a port-forward `node -e` |
| `CODESPACES=true`, `CODESPACE_NAME` | GitHub Codespaces | Codespace | Yes per docs (set for every codespace; not tested here) | Only via `.envrc` + `code .`, or `remoteEnv`/`containerEnv` inside a container | Yes | absent |
| `GITPOD_WORKSPACE_ID` (Classic) | Gitpod | Gitpod workspace | Yes per docs (not tested) | Same as above; Gitpod itself overwrites `GITPOD_*` user variables | Yes | absent |
| `container` | Podman (`container=podman`), systemd-nspawn, LXC; **not Docker** | Set for PID 1 per the systemd container interface; Podman puts it in the container's default env | Yes under Podman, since `exec`'d processes get the container env (inferred) | Same as above | Yes | absent (Docker) |
| `DEVCONTAINER` | Nobody in Dev Containers 0.470.0 (the bundle only reads `DEVCONTAINER_CLI_PATH` and `DEVCONTAINERS_OCI_AUTH`) | Only what an image or user sets | If set in the image or profile | Yes (`containerEnv`) | Yes | absent |
| `/.dockerenv` | Docker/Moby init layer | Docker container | It is a file; the host reads it with `fs` | No (needs root at `/` on the host) | No | present, empty, `root:root 0755`, created 2026-10-02 |
| `/run/.containerenv` | Podman | Podman container (has engine and image details under `--privileged`) | File | No | No | absent |
| `/run/host/container-manager` | Container managers following the systemd interface | Same string as `$container` | File | No | No | absent |
| cgroup (`/proc/1/cgroup`) | Kernel | Under cgroup v2 with cgroup namespaces it only shows `0::/` paths, no engine name | File | No | No | `0::/init` (no hint) |
| `/proc/self/mountinfo` | Kernel | Root is `overlay` with `/var/lib/docker/...` lower dirs | File | No | No | overlay root under `/var/lib/docker/containerd/...` |

`systemd-detect-virt -c` here prints `docker`, which agrees with `/.dockerenv`.

## How `remoteName` is set

**source** — `src/vs/platform/remote/common/remoteHosts.ts` (`microsoft/vscode`): `getRemoteName(authority)` returns the part of the remote authority before `+` (or the whole authority if there is no `+`). The authority comes from the resolver extension that the window was opened with, for example `dev-container+<hex>`.

**documented** — [VS Code API, `env.remoteName`](https://code.visualstudio.com/api/references/vscode-api#env): "The name of a remote. Defined by extensions, popular samples are `wsl` for the Windows Subsystem for Linux or `ssh-remote` for remotes using a secure shell." and "The value is `undefined` when there is no remote extension host but that the value is defined in all extension hosts (local and remote) in case a remote extension host exists." [Supporting Remote Development](https://code.visualstudio.com/api/advanced-topics/remote-extensions) says Codespaces in the browser also reports `UIKind.Web`.

**source** — `activationEvents` in each VSIX's `package.json` (downloaded from the Marketplace gallery API on 2026-10-09):

| Extension | Version | Resolver names (`onResolveRemoteAuthority:*`) |
|---|---|---|
| `ms-vscode-remote.remote-containers` | 0.470.0 | `dev-container`, `attached-container`, `k8s-container`, `apple-container` |
| `GitHub.codespaces` | 1.18.16 | `codespaces` |
| `ms-vscode-remote.remote-wsl` | 0.104.3 | `wsl` |
| `ms-vscode-remote.remote-ssh` | 0.129.2026091815 | `ssh-remote` |
| `ms-vscode.remote-server` (Tunnels) | 1.6.2026092109 | `tunnel` |

Registering a resolver needs the proposed `resolvers` API. **source** — this server's `product.json` allowlists it only for those extensions plus `ms-toolsai.vscode-ai-remote`, `ms-windows-ai-studio.vscode-foundry-training` and `GitHub.copilot-chat`. A Marketplace extension from anyone else can't add a resolver called `dev-container` in stable VS Code. VS Code forks ship their own `product.json` and may differ (not checked).

**documented** — Gitpod/Ona: [VS Code Desktop with Ona](https://ona.com/docs/ona/editors/vscode) connects "over SSH" and needs Remote - SSH, so `remoteName` is `ssh-remote` there. Only a marker file or `GITPOD_*` tells you it's a Gitpod container.

## How environment variables reach the extension host

Three layers, later ones win:

1. **The server's own environment.** For Dev Containers that is whatever `docker exec` gives the server: the image's `ENV`, `containerEnv` from `devcontainer.json` (**documented**, [containers.dev reference](https://containers.dev/implementors/json_reference/): `containerEnv` "sets or overrides environment variables for the container"), and, under Podman, `container=podman` (**source**, `containers/podman` `pkg/env/env.go` `DefaultEnvVariables()` returns `PATH` and `"container": "podman"`).
2. **The user's shell environment.** **source** — `src/vs/server/node/extensionHostConnection.ts` `buildUserEnvironment()` builds the host env as `{ ...process.env, ...userShellEnv, ...startParamsEnv, ... }`, where `userShellEnv` comes from `getResolvedShellEnv()` (a login shell run). Dev Containers starts the server with `--force-disable-user-env` (**observed**, server command line) and probes the shell itself instead: `userEnvProbe` defaults to `loginInteractiveShell` (**documented**, containers.dev reference).
3. **The resolver's `extensionHostEnv`** (`startParamsEnv`). **source** — Dev Containers 0.470.0 bundle returns `resolvedAuthority: { host, port, connectionToken, extensionHostEnv }`, and computes that env as `{ ...probedShellEnv, ..., REMOTE_CONTAINERS: "true", ...remoteEnv }`. So `REMOTE_CONTAINERS=true` beats the shell profile, and `remoteEnv` from `devcontainer.json` beats both. A Dev Containers maintainer says the same in [vscode-remote-release#7799](https://github.com/microsoft/vscode-remote-release/issues/7799): "The resolver is returning it in `extensionHostEnv`." **documented** — `remoteEnv` applies to "VS Code and related sub-processes (terminals, tasks, debugging, etc.)" ([Environment variables in dev containers](https://code.visualstudio.com/remote/advancedcontainers/environment-variables)).

**observed** — names only, extension host (pid 212647) minus server (pid 277): `REMOTE_CONTAINERS REMOTE_CONTAINERS_IPC REMOTE_CONTAINERS_SOCKETS SSH_AUTH_SOCK BROWSER` (resolver and server) and `NVM_BIN NVM_INC NVM_CD_FLAGS STARSHIP_CONFIG STARSHIP_SESSION_KEY STARSHIP_SHELL _ZO_DATA_DIR HISTFILE` (from the user's zsh profile via the probe). So a profile line `export CODESPACES=true` would reach the host too.

**Local windows.** **source** — `src/vs/platform/launch/electron-main/launchMainService.ts`: when a window is opened from the CLI (`code .`), the CLI's environment is passed as the window's `userEnv`. That is the only way a repository file can get variables into a non-remote extension host: an `.envrc` loaded by direnv in the terminal the user launched `code` from. `.vscode/settings.json` has no setting that changes the extension host's environment (`terminal.integrated.env.*` only affects terminals). `devcontainer.json` is only read once the window is in a container.

`VSCODE_REMOTE_CONTAINERS_SESSION` is not in the extension host. **source** — the bundle sets it on the keep-alive `docker exec ... /bin/sh -c "... export VSCODE_REMOTE_CONTAINERS_SESSION=<id> ; /bin/sh"` and on helper processes, and greps `/proc/*/environ` for it to find its own sessions. **observed** — present on the keep-alive shell (pid 211357) and a port-forward helper, absent from the extension host.

**documented** — Codespaces: [Default environment variables](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace) lists `CODESPACES` ("Always `true` while in a codespace") and `CODESPACE_NAME`. Which processes get them is not stated. **documented** — Gitpod Classic ([environment variables](https://ona.com/docs/classic/user/configure/workspaces/environment-variables)): `GITPOD_WORKSPACE_ID`, `GITPOD_WORKSPACE_URL`, `GITPOD_REPO_ROOT`; "Gitpod reserves the `GITPOD_` prefix … will be ignored and overwritten during workspace startup." That protects the variable inside Gitpod, not elsewhere.

## Marker files

**source** — `moby/moby` `daemon/initlayer/setup_unix.go`: the init layer, "used by all containers as the top-most ro layer", creates `/.dockerenv` as an empty file, alongside `/etc/hosts` and `/etc/hostname`. Here the daemon uses the containerd snapshotter and the file is still present.

**documented** — [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html): "a container environment file is created in each container to indicate to programs they are running in a container. This file is located at `/run/.containerenv`" and it "will not be created when a volume is mounted on /run". With `--privileged` it holds the engine version, rootless flag, container and image name and ID.

**documented** — [systemd Container Interface](https://systemd.io/CONTAINER_INTERFACE/): managers should set `$container` for PID 1 and may write the same string to `/run/host/container-manager`. Docker does neither (observed: no `container` variable, no `/run/host`).

Spoofing: creating a file at `/` or `/run` needs root on the host. A repo can't do it without the user running something with `sudo`. Inside a container, the image can't remove `/.dockerenv`, because the init layer adds it on top of the image (inferred from the init-layer code).

## This devcontainer

- Image `ghcr.io/dbarjs/agent-devcontainer/node:latest`, Docker-in-Docker, Debian trixie, cgroup v2 with cgroupns, hostname `d6857d0fb342`. `devcontainer.json` sets no `containerEnv` or `remoteEnv`.
- Shell `env | sort` filtered to REMOTE/CONTAINER/CODESPACE/VSCODE/DEVCONTAINER/GITPOD: `REMOTE_CONTAINERS=true`, `REMOTE_CONTAINERS_IPC=/tmp/vscode-remote-containers-ipc-3f41ab09-….sock`, `REMOTE_CONTAINERS_SOCKETS=["/tmp/vscode-ssh-auth-3f41ab09-….sock"]`, plus VS Code terminal variables (`VSCODE_GIT_ASKPASS_*`, `VSCODE_GIT_IPC_HANDLE`, `VSCODE_INJECTION`, `VSCODE_IPC_HOOK_CLI`, `VSCODE_PYTHON_AUTOACTIVATE_GUARD`). No `CODESPACES`, `GITPOD_*`, `DEVCONTAINER`, `container`, `VSCODE_REMOTE_CONTAINERS_SESSION`.
- Extension host process (`bootstrap-fork --type=extensionHost`): the same three `REMOTE_CONTAINERS*` variables.
- Server process (`server-main.js --force-disable-user-env …`): none of them.
- `/.dockerenv`: `-rwxr-xr-x 1 root root 0 Oct 2 19:04`. `/run/.containerenv`: absent.
- `/proc/1/cgroup`: `0::/init`. Root mount: `overlay` with lower dirs under `/var/lib/docker/containerd/daemon/...`.

## Open questions

- `env.remoteName` was not read from inside a running extension here; `dev-container` is inferred from the Dev Containers session variables. The Hero Synergy extension can log it at activation to confirm.
- Codespaces and Gitpod values were not measured; they come from docs.
- VS Code forks (Cursor, Windsurf, VSCodium) use their own remote extensions and `product.json`; their `remoteName` values were not checked.
