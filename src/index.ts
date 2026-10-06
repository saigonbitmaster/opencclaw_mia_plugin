import { Client as MinaSignerClient } from "mina-signer";
import axios from "axios";

export interface MinaPluginConfig {
  endpoint?: string;
  privateKey?: string;
}

interface GraphQLAccountResponse {
  data?: {
    account?: {
      nonce: string;
    } | null;
  };
}

interface GraphQLPoolResponse {
  data?: {
    pooledUserCommands?: Array<{ hash: string }>;
  };
}

function buildDevnetUrl(txHash: string): string {
  const domain = "https://minascan.io";
  const path = "/devnet/tx/";
  return domain + path + txHash;
}

export async function fetchCurrentNonce(
  endpoint: string,
  publicKey: string,
): Promise<number> {
  const query = {
    query: `
      query GetNonce($publicKey: PublicKey!) {
        account(publicKey: $publicKey) {
          nonce
        }
      }
    `,
    variables: { publicKey },
  };

  const response = await axios.post<GraphQLAccountResponse>(endpoint, query, {
    headers: { "Content-Type": "application/json" },
  });

  const accountData = response.data?.data?.account;
  return accountData ? parseInt(accountData.nonce, 10) : 0;
}

export async function executeMinaPayment(
  endpoint: string,
  privateKey: string,
  receiver: string,
  amountMina: number,
): Promise<string> {
  const signer = new MinaSignerClient({ network: "testnet" });
  const senderPublicKey = signer.derivePublicKey(privateKey);

  const currentNonce = await fetchCurrentNonce(endpoint, senderPublicKey);

  const amountNanomina = (amountMina * 1_000_000_000).toString();
  const feeNanomina = (0.01 * 1_000_000_000).toString();

  const payload = {
    from: senderPublicKey,
    to: receiver,
    amount: amountNanomina,
    fee: feeNanomina,
    nonce: currentNonce.toString(),
    memo: "OpenClaw Tx",
  };

  const signedTx = signer.signPayment(payload, privateKey);

  const mutation = {
    query: `
      mutation SendPayment($payload: SendPaymentInput!, $signature: SignatureInput!) {
        sendPayment(input: $payload, signature: $signature) {
          payment {
            hash
          }
        }
      }
    `,
    variables: {
      payload: {
        fee: signedTx.data.fee,
        from: signedTx.data.from,
        to: signedTx.data.to,
        amount: signedTx.data.amount,
        nonce: signedTx.data.nonce,
        memo: signedTx.data.memo,
      },
      signature: {
        field: signedTx.signature.field,
        scalar: signedTx.signature.scalar,
      },
    },
  };

  const broadcastResponse = await axios.post(endpoint, mutation, {
    headers: { "Content-Type": "application/json" },
  });

  if (broadcastResponse.data?.errors) {
    throw new Error(
      "Node exception: " + JSON.stringify(broadcastResponse.data.errors),
    );
  }
  
  return broadcastResponse.data.data.sendPayment.payment.hash;
}

export async function traceTransaction(
  endpoint: string,
  txHash: string,
): Promise<string> {
  const poolQuery = {
    query: `
      query GetPendingPool {
        pooledUserCommands {
          hash
        }
      }
    `,
  };

  try {
    const poolResponse = await axios.post<GraphQLPoolResponse>(
      endpoint,
      poolQuery,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    const pendingTxList = poolResponse.data?.data?.pooledUserCommands || [];
    const isPending = pendingTxList.some((tx) => tx.hash === txHash);

    if (isPending) {
      return "PENDING";
    }
  } catch (e) {
    // If context or api logging structure isn't available inside isolated helper functions, fallback cleanly
    console.warn("Mempool lookup unavailable, checking recent ledger blocks...");
  }

  const blockQuery = {
    query: `
      query SearchRecentBlocks {
        bestChain(maxLength: 30) {
          transactions {
            userCommands {
              hash
            }
          }
        }
      }
    `,
  };

  const blockResponse = await axios.post<any>(endpoint, blockQuery, {
    headers: { "Content-Type": "application/json" },
  });

  if (blockResponse.data?.errors) {
    throw new Error(
      "Node lookup failure: " + JSON.stringify(blockResponse.data.errors),
    );
  }

  const chains = blockResponse.data?.data?.bestChain || [];
  for (const block of chains) {
    const userCommands = block.transactions?.userCommands || [];
    const hashFound = userCommands.some((tx: any) => tx.hash === txHash);
    if (hashFound) {
      return "INCLUDED";
    }
  }

  return "UNKNOWN";
}
/* 
export function initializePlugin(api: any) {
  const endpoint = process.env.MINA_DEVNET_ENDPOINT || "https://o1test.net";
  const privateKey = process.env.MINA_PRIVATE_KEY;

  // 1. Using OpenClaw's structured root logger object
  if (api.logger) {
    api.logger.info(`[MinaPlugin] Initialized successfully using endpoint: ${endpoint}`);
  }

  api.registerCommand({
    name: "send_mina",
    description: "Execute a cryptographically signed MINA transfer on Devnet",
    usage: "/send_mina [receiver_address] [amount]",
    handler: async (context: any) => {
      // Safely resolve the logging mechanism available on the context layout or root api
      const logInfo = (msg: string) => context.info ? context.info(msg) : (api.logger ? api.logger.info(msg) : console.log(msg));
      const logWarn = (msg: string) => context.warn ? context.warn(msg) : (api.logger ? api.logger.warn(msg) : console.warn(msg));
      const logError = (msg: string) => context.error ? context.error(msg) : (api.logger ? api.logger.error(msg) : console.error(msg));

      if (!privateKey) {
        logError("[MinaPlugin][send_mina] Command aborted: MINA_PRIVATE_KEY environment variable missing.");
        return context.reply(
          "❌ Error: MINA_PRIVATE_KEY environment variable is not set.",
        );
      }

      const [receiver, amountStr] = context.args;
      if (!receiver || !amountStr) {
        logWarn("[MinaPlugin][send_mina] Validation failed: Missing arguments.");
        return context.reply(
          "❌ Usage error. Type: `/send_mina [address] [amount]`",
        );
      }

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        logWarn(`[MinaPlugin][send_mina] Validation failed: Invalid numeric amount input "${amountStr}".`);
        return context.reply("❌ Validation error: Invalid token amount.");
      }

      try {
        logInfo(`[MinaPlugin][send_mina] Attempting transaction. Amount: ${amount} MINA, Receiver: ${receiver}`);
        await context.showTypingIndicator();
        
        const txHash = await executeMinaPayment(
          endpoint,
          privateKey,
          receiver,
          amount,
        );
        const finalUrl = buildDevnetUrl(txHash);

        logInfo(`[MinaPlugin][send_mina] SUCCESS: Transaction dispatched. Hash: ${txHash}`);

        return context.reply(
          "✨ *Transaction Dispatched Successfully!*\n\n" +
            "🔗 *Hash:* `" +
            txHash +
            "`\n" +
            "🔍 [View on Minascan Explorer](" +
            finalUrl +
            ")",
        );
      } catch (err: any) {
        logError(`[MinaPlugin][send_mina] ERROR executing transaction to ${receiver}: ${err.message || err}`);
        return context.reply("❌ Execution Failure: " + err.message);
      }
    },
  });

  api.registerCommand({
    name: "query_tx",
    description: "Inspect the live validation state of a transaction hash",
    usage: "/query_tx [transaction_hash]",
    handler: async (context: any) => {
      const logInfo = (msg: string) => context.info ? context.info(msg) : (api.logger ? api.logger.info(msg) : console.log(msg));
      const logWarn = (msg: string) => context.warn ? context.warn(msg) : (api.logger ? api.logger.warn(msg) : console.warn(msg));
      const logError = (msg: string) => context.error ? context.error(msg) : (api.logger ? api.logger.error(msg) : console.error(msg));

      const [txHash] = context.args;
      if (!txHash) {
        logWarn("[MinaPlugin][query_tx] Validation failed: Missing transaction hash.");
        return context.reply("❌ Usage error. Type: `/query_tx [hash]`");
      }

      try {
        logInfo(`[MinaPlugin][query_tx] Querying status for hash: ${txHash}`);
        
        const status = await traceTransaction(endpoint, txHash);
        const finalUrl = buildDevnetUrl(txHash);

        logInfo(`[MinaPlugin][query_tx] SUCCESS: Found transaction state: [${status}] for hash: ${txHash}`);

        return context.reply(
          `📊 *Transaction Status Request*\n` +
          `🔗 *Hash:* \`\${txHash}\`\n` +
          `🚦 *State:* \`\${status}\`\n\n` +
          `🔍 [View on Explorer](${finalUrl})`
        );
      } catch (err: any) {
        logError(`[MinaPlugin][query_tx] ERROR inspecting transaction ${txHash}: ${err.message || err}`);
        return context.reply("❌ Lookup Failure: " + err.message);
      }
    },
  });
}
 */
export function initializePlugin(api: any) {
  const endpoint = process.env.MINA_DEVNET_ENDPOINT || "https://o1test.net";
  const privateKey = process.env.MINA_PRIVATE_KEY;

  if (api.logger) {
    api.logger.info(`[MinaPlugin] Initialized successfully using endpoint: ${endpoint}`);
  }

  // 1. Register a slash command (/ping_mina)
  api.registerCommand({
    name: "ping_mina",
    acceptsArgs: false, // Turned false since /ping_mina requires no arguments
    description: "Check if the mina extension is alive",
    handler: () => {
      return { text: "Pong! Your mina plugin is working perfectly! 🚀" };
    }
  });

  // 2. Corrected and insulated /mina_send command
  api.registerCommand({
    name: "mina_send",
    description: "Execute a cryptographically signed MINA transfer on Devnet",
    usage: "/mina_send [receiver_address] [amount]",
    acceptsArgs: true,
    handler: async (context: any) => {
      const logInfo = (msg: string) => context.info ? context.info(msg) : (api.logger ? api.logger.info(msg) : console.log(msg));
      const logWarn = (msg: string) => context.warn ? context.warn(msg) : (api.logger ? api.logger.warn(msg) : console.warn(msg));
      const logError = (msg: string) => context.error ? context.error(msg) : (api.logger ? api.logger.error(msg) : console.error(msg));

      try {
        if (!privateKey) {
          logError("[MinaPlugin][mina_send] Command aborted: MINA_PRIVATE_KEY environment variable missing.");
          return { text: "❌ Error: MINA_PRIVATE_KEY environment variable is not set." };
        }

        // DYNAMIC ARGUMENT PARSING FIX: Handles raw text strings and array contexts securely
        let parsedArgs: string[] = [];
        if (context && context.args) {
          if (Array.isArray(context.args)) {
            if (context.args.length === 1 && typeof context.args[0] === "string") {
              parsedArgs = context.args[0].trim().split(/\s+/);
            } else {
              parsedArgs = context.args.map((a: any) => String(a).trim());
            }
          } else if (typeof context.args === "string") {
            parsedArgs = context.args.trim().split(/\s+/);
          }
        }

        const receiver = parsedArgs[0];
        const amountStr = parsedArgs[1];

        if (!receiver || !amountStr) {
          logWarn(`[MinaPlugin][mina_send] Validation failed: Expected 2 arguments, got ${parsedArgs.length}.`);
          return { text: "❌ Usage error. Type: `/mina_send [address] [amount]`" };
        }

        // Defensive address validation check
        if (!receiver.startsWith("B62") || receiver.length !== 55) {
          logWarn(`[MinaPlugin][mina_send] Validation failed: Invalid Mina address format: "${receiver}"`);
          return { text: "❌ Validation error: Invalid Mina public address format. It must start with 'B62' and be exactly 55 characters long." };
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
          logWarn(`[MinaPlugin][mina_send] Validation failed: Invalid numeric amount input "${amountStr}".`);
          return { text: "❌ Validation error: Invalid token amount." };
        }

        logInfo(`[MinaPlugin][mina_send] Attempting transaction. Amount: ${amount} MINA, Receiver: ${receiver}`);
        
        if (context.showTypingIndicator) {
          await context.showTypingIndicator();
        }
        
        const txHash = await executeMinaPayment(
          endpoint,
          privateKey,
          receiver,
          amount,
        );
        const finalUrl = buildDevnetUrl(txHash);

        logInfo(`[MinaPlugin][mina_send] SUCCESS: Transaction dispatched. Hash: ${txHash}`);

        return {
          text: "✨ *Transaction Dispatched Successfully!*\n\n" +
                "🔗 *Hash:* `" + txHash + "`\n" +
                "🔍 [View on Minascan Explorer](" + finalUrl + ")"
        };
      } catch (err: any) {
        logError(`[MinaPlugin][mina_send] CRITICAL EXCEPTION caught inside handler: ${err.message || err}`);
        return { text: "❌ Execution Failure: " + (err.message || "Unknown plugin exception") };
      }
    },
  });

  // 3. Corrected and insulated /query_tx command
  api.registerCommand({
    name: "query_tx",
    description: "Inspect the live validation state of a transaction hash",
    usage: "/query_tx [transaction_hash]",
    acceptsArgs: true,
    handler: async (context: any) => {
      const logInfo = (msg: string) => context.info ? context.info(msg) : (api.logger ? api.logger.info(msg) : console.log(msg));
      const logWarn = (msg: string) => context.warn ? context.warn(msg) : (api.logger ? api.logger.warn(msg) : console.warn(msg));
      const logError = (msg: string) => context.error ? context.error(msg) : (api.logger ? api.logger.error(msg) : console.error(msg));

      try {
        // DYNAMIC ARGUMENT PARSING FIX FOR QUERY
        let parsedArgs: string[] = [];
        if (context && context.args) {
          if (Array.isArray(context.args)) {
            if (context.args.length === 1 && typeof context.args[0] === "string") {
              parsedArgs = context.args[0].trim().split(/\s+/);
            } else {
              parsedArgs = context.args.map((a: any) => String(a).trim());
            }
          } else if (typeof context.args === "string") {
            parsedArgs = context.args.trim().split(/\s+/);
          }
        }

        const txHash = parsedArgs[0];

        if (!txHash) {
          logWarn("[MinaPlugin][query_tx] Validation failed: Missing transaction hash.");
          return { text: "❌ Usage error. Type: `/query_tx [hash]`" };
        }

        logInfo(`[MinaPlugin][query_tx] Querying status for hash: ${txHash}`);
        
        const status = await traceTransaction(endpoint, txHash);
        const finalUrl = buildDevnetUrl(txHash);

        logInfo(`[MinaPlugin][query_tx] SUCCESS: Found transaction state: [${status}] for hash: ${txHash}`);

        return {
          text: `📊 *Transaction Status Request*\n` +
                `🔗 *Hash:* \`\${txHash}\`\n` +
                `🚦 *State:* \`\${status}\`\n\n` +
                `🔍 [View on Explorer](${finalUrl})`
        };
      } catch (err: any) {
        logError(`[MinaPlugin][query_tx] CRITICAL EXCEPTION caught inside handler: ${err.message || err}`);
        return { text: "❌ Lookup Failure: " + (err.message || "Unknown plugin exception") };
      }
    },
  });
}


export default initializePlugin;
