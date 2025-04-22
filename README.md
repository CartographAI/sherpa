<div align="center">
<img src="https://github.com/user-attachments/assets/27d259d3-f8a9-4200-ae5e-4410f5135bd2" alt="Sherpa" width="200">

# Sherpa, your friendly codebase guide

`npx @cartographai/sherpa <folder or git url>`

**Chat with any codebase with a single command.**

<br>

![sherpa](https://github.com/user-attachments/assets/338aeefa-80f0-4124-9623-4cddb128b95f)
<figcaption>Asking Sherpa about itself</figcaption>

</div>

## Features

-   **Intelligent Code Analysis:** Sherpa intelligently determines which files to read to answer your questions about a codebase. It uses a combination of tools to understand the project structure and content.
-   **Multiple LLM Support:** Sherpa supports various language models, including Anthropic's Claude Sonnet 3.5, Google's Gemini 2.5, and OpenAI's GPT-4o and o3-mini models.
-   **Fully Local and Private:** Bring your own API key, no data is sent to our servers
-   **Interactive Chat Interface:** A user-friendly web UI (built with SvelteKit) allows you to interact with Sherpa, view the tools being used, and see the context provided to the language model.
-   **Chat History:** Your conversation history is stored locally in your browser's local storage, so you can easily pick up where you left off.
-   **Secure Filesystem Access:** Sherpa uses a secure Model Context Protocol filesystem server that restricts access to a specified directory, preventing unauthorized file access.
-   **Git Support:** You can use Sherpa with local directories or directly with remote Git repositories.
-   **Open Source:** Sherpa is open source, allowing you to modify and extend it for your specific use cases.
-   ⭐ [New!] **MCP Tools Support:** Configure Sherpa with any MCP servers to extend its functionality.

## Usage

1.  **Run Sherpa:** Execute the following command in your terminal, replacing `<path/to/your/project>` with the actual path to your project or `<git_url>` with a Git repository URL:

```bash
npx @cartographai/sherpa <path/to/your/project>
```
or

```bash
npx @cartographai/sherpa <git_url>
```
This command will:
*   Clone the repository to a cache directory if a git url is provided.
*   Start a local server (Hono) that handles API requests.
*   Open the Sherpa web app in your default browser (`localhost:3031`).

2.  **Configure API Keys:** In the web app's settings panel (click the "Config" button), enter your API keys for the language models you want to use (Anthropic, Gemini, or OpenAI).

3.  **Start Chatting:**  Ask Sherpa questions about the codebase.  You can refer to specific files or directories, and Sherpa will use its tools to find the relevant information.

## Use with MCPs

Sherpa supports [Model Context Protocol](https://modelcontextprotocol.org/) (MCP) tools. 

1. **Configure MCP servers:** Open or create `~/.config/sherpa/mcp_servers.json`, and configure MCP servers following [Claude Desktop's format](https://modelcontextprotocol.io/examples#configuring-with-claude).
<details>
  <summary>Example config file</summary>

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "time": {
      "command": "uvx",
      "args": ["mcp-server-time", "--local-timezone=Asia/Singapore"]
    },
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```
</details>

2. **Quit and re-run Sherpa.** It will connect to all configured MCP servers on startup.

3. **Chat:** The model can now use MCP tools in your chat. You can view configured MCP servers and their connection status in the Configuration panel.

<img width="480" alt="List of configured MCP servers with connected or error status" src="https://github.com/user-attachments/assets/ab1f79cc-65f5-40cf-b74a-bfd94a9fa45b" />


## How it Works

Sherpa reads (or clones) a codebase:
- Launches a web app and a sandbox server to access your code
- Use the chat interface to ask questions about the codebase
- Sherpa intelligently uses tools to read and explore the codebase to find the context to answer your question (or you can ask it to read all the files immediately)

To know more, ask Sherpa to explain itself

```bash
npx @cartographai/sherpa https://github.com/CartographAI/sherpa.git
```

## Development

To run Sherpa in development mode:

### Setup Instructions

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/CartographAI/sherpa
    cd sherpa
    ```

2.  **Install dependencies:**
    ```bash
    bun install
    ```
3.  **Build the project:**
    ```bash
    bun run build
    ```
### Running the Application

#### Backend Server

Start the backend server with either a local project path or git URL
```bash
bun run dev:server <path/to/your/project>
```
or

```bash
bun run dev:server <git_url>
```

The backend server will be available at `http://localhost:3031`

Note that the backend bundles the web app so if you are only developing the backend, you don't need to run the web application.

#### Web Application (Optional)

In a separate terminal
```bash
bun run dev:web
```
This will start the web app with hot reloading.
Open `http://localhost:3030` in your browser.
This requires the backend server to be running.

## Acknowledgements

- The video [I look at open source differently now](https://www.youtube.com/watch?v=Xp1pdKx3JfQ) by [Hrishi](https://x.com/hrishioa)
was the inspiration to create this as an open source tool.
- Anthropic's Model Context Protocol [filesystem implementation](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)
- Simon Willson's [files-to-prompt](https://github.com/simonw/files-to-prompt) repo for
[XML template implementation](https://github.com/simonw/files-to-prompt/blob/f9a4d8fa20aa978c3502c94de335b44e57ac0a61/files_to_prompt/cli.py#L43C1-L51C22)
