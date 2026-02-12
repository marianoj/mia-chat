import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { useQueryParams } from "./use-query-params";
import {
  AGENT_INBOX_PARAM,
  AGENT_INBOXES_LOCAL_STORAGE_KEY,
  NO_INBOXES_FOUND_PARAM,
  OFFSET_PARAM,
  LIMIT_PARAM,
  INBOX_PARAM,
} from "../constants";
import { useLocalStorage } from "./use-local-storage";
import { useState, useCallback, useEffect, useRef } from "react";
import { AgentInbox } from "../types";
import { useRouter } from "next/navigation";
import { logger } from "../utils/logger";
import { runInboxBackfill } from "../utils/backfill";
import { fetchDeploymentInfo, isDeployedUrl } from "../utils";

// Environment variable defaults for deployment
const DEFAULT_DEPLOYMENT_URL = process.env.NEXT_PUBLIC_API_URL;
const DEFAULT_ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID;
const DEFAULT_LANGSMITH_API_KEY = process.env.NEXT_PUBLIC_LANGSMITH_API_KEY;

/**
 * Parse NEXT_PUBLIC_INBOXES env var (JSON array of inbox configs).
 * Each entry should have: { graphId, deploymentUrl, name? }
 */
function parseEnvInboxes(): AgentInbox[] | null {
  const raw = process.env.NEXT_PUBLIC_INBOXES;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    return parsed.map((entry: any, idx: number) => ({
      id: `env-${entry.graphId}`,
      graphId: entry.graphId,
      deploymentUrl: entry.deploymentUrl,
      name: entry.name || entry.graphId,
      selected: idx === 0,
      createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error("Error parsing NEXT_PUBLIC_INBOXES env var", error);
    return null;
  }
}

/**
 * Build inboxes from environment variables.
 * Supports both NEXT_PUBLIC_INBOXES (array) and the legacy
 * NEXT_PUBLIC_API_URL + NEXT_PUBLIC_ASSISTANT_ID (single inbox).
 */
function getEnvInboxes(): AgentInbox[] | null {
  // Prefer the array format
  const arrayInboxes = parseEnvInboxes();
  if (arrayInboxes) return arrayInboxes;

  // Fall back to single inbox from legacy env vars
  if (DEFAULT_DEPLOYMENT_URL && DEFAULT_ASSISTANT_ID) {
    return [
      {
        id: `env-${DEFAULT_ASSISTANT_ID}`,
        graphId: DEFAULT_ASSISTANT_ID,
        deploymentUrl: DEFAULT_DEPLOYMENT_URL,
        name: DEFAULT_ASSISTANT_ID,
        selected: true,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return null;
}

/**
 * Enrich env-configured inboxes with deployment info (project_id, tenant_id).
 * This enables features like "Open in Studio" that require these IDs.
 */
async function enrichEnvInboxes(
  inboxes: AgentInbox[]
): Promise<AgentInbox[]> {
  const enriched = await Promise.all(
    inboxes.map(async (inbox) => {
      if (!isDeployedUrl(inbox.deploymentUrl)) return inbox;

      try {
        const info = await fetchDeploymentInfo(inbox.deploymentUrl);
        if (info?.host?.project_id) {
          return {
            ...inbox,
            id: `${info.host.project_id}:${inbox.graphId}`,
            ...(info.host.tenant_id && { tenantId: info.host.tenant_id }),
          };
        }
        if (info?.host?.tenant_id) {
          return { ...inbox, tenantId: info.host.tenant_id };
        }
      } catch (error) {
        logger.error(
          `Failed to fetch deployment info for ${inbox.deploymentUrl}`,
          error
        );
      }
      return inbox;
    })
  );
  return enriched;
}

/** Whether inboxes are configured via environment variables */
export const ENV_INBOXES_CONFIGURED = getEnvInboxes() !== null;

/** Whether the API key is configured via environment variables */
export const ENV_API_KEY_CONFIGURED = Boolean(DEFAULT_LANGSMITH_API_KEY);

/**
 * Get the API key from environment. Returns null if not set.
 */
export function getEnvApiKey(): string | null {
  return DEFAULT_LANGSMITH_API_KEY || null;
}

/**
 * Hook for managing agent inboxes
 *
 * When env vars are configured, inboxes come exclusively from env vars
 * and are never persisted to localStorage.
 * When no env vars are set, falls back to localStorage behavior.
 *
 * @returns {Object} Object containing agent inboxes and methods to manage them
 */
export function useInboxes() {
  const { getSearchParam, updateQueryParams } = useQueryParams();
  const router = useRouter();
  const { getItem, setItem } = useLocalStorage();
  const { toast } = useToast();
  const [agentInboxes, setAgentInboxes] = useState<AgentInbox[]>([]);
  const initialLoadComplete = useRef(false);

  /**
   * Check if environment variables are configured
   */
  const hasEnvConfig = ENV_INBOXES_CONFIGURED;

  /**
   * Run backfill and load initial inboxes on mount
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const initializeInboxes = async () => {
      // If env vars are configured, use them exclusively (no localStorage)
      if (hasEnvConfig) {
        const envInboxes = getEnvInboxes();
        if (envInboxes && envInboxes.length > 0) {
          logger.log("Using inboxes exclusively from environment variables", {
            count: envInboxes.length,
            inboxes: envInboxes.map((i) => i.id),
          });

          // Set initial state immediately so the UI is responsive
          setAgentInboxes(envInboxes);

          const selectedInbox = envInboxes.find((i) => i.selected) || envInboxes[0];
          updateQueryParams(
            [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
            [selectedInbox.id, "0", "10", "interrupted"]
          );

          // Enrich with deployment info (project_id, tenant_id) in background
          enrichEnvInboxes(envInboxes).then((enrichedInboxes) => {
            const enrichedSelected =
              enrichedInboxes.find((i) => i.selected) || enrichedInboxes[0];
            // Update state with enriched inboxes
            setAgentInboxes(enrichedInboxes);
            // Update URL if the selected inbox ID changed (env-X -> projectId:graphId)
            if (enrichedSelected.id !== selectedInbox.id) {
              updateQueryParams(AGENT_INBOX_PARAM, enrichedSelected.id);
            }
          });
          return;
        }
      }

      // No env vars configured - fall back to localStorage behavior
      try {
        // Run the backfill process first
        const backfillResult = await runInboxBackfill();
        if (backfillResult.success) {
          if (backfillResult.updatedInboxes.length > 0) {
            setAgentInboxes(backfillResult.updatedInboxes);
            logger.log(
              "Initialized inboxes state after backfill:",
              backfillResult.updatedInboxes
            );
            getAgentInboxes(backfillResult.updatedInboxes);
          } else {
            // No inboxes found and no env vars - show add inbox dialog
            logger.log("No inbox configuration available, showing add dialog");
            setAgentInboxes([]);
            updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
          }
        } else {
          logger.error("Backfill failed, attempting normal inbox load");
          getAgentInboxes();
        }
      } catch (e) {
        logger.error("Error during initial inbox loading and backfill", e);
        getAgentInboxes();
      }
    };
    initializeInboxes();
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load agent inboxes from local storage and set up proper selection state
   * Accepts optional preloaded inboxes to avoid re-reading localStorage immediately after backfill.
   * NOTE: This is only called when env vars are NOT configured (localStorage fallback mode)
   */
  const getAgentInboxes = useCallback(
    async (preloadedInboxes?: AgentInbox[]) => {
      if (typeof window === "undefined") {
        return;
      }

      // If env vars are configured, don't use this function (handled in useEffect)
      if (hasEnvConfig) {
        return;
      }

      let currentInboxes: AgentInbox[] = [];
      if (preloadedInboxes) {
        currentInboxes = preloadedInboxes;
        logger.log("Using preloaded inboxes for selection logic");
      } else {
        const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);
        logger.log(
          "Reading inboxes from localStorage for selection logic:",
          agentInboxesStr
        );
        if (agentInboxesStr && agentInboxesStr !== "[]") {
          try {
            currentInboxes = JSON.parse(agentInboxesStr);
          } catch (error) {
            logger.error(
              "Error parsing agent inboxes for selection logic",
              error
            );
            setAgentInboxes([]);
            updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
            return;
          }
        } else {
          logger.log("No inboxes in localStorage for selection logic");
          setAgentInboxes([]);
          updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
          return;
        }
      }

      if (!currentInboxes.length) {
        logger.log("No current inboxes to process selection logic");
        setAgentInboxes([]);
        updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
        return;
      }

      // Ensure each agent inbox has an ID, and if not, add one
      currentInboxes = currentInboxes.map((inbox) => {
        return {
          ...inbox,
          id: inbox.id || uuidv4(),
        };
      });

      const agentInboxSearchParam = getSearchParam(AGENT_INBOX_PARAM);
      logger.log(
        "Agent inbox search param for selection:",
        agentInboxSearchParam
      );

      // If there is no agent inbox search param, or the search param does not match any inbox
      // update search param and local storage
      if (!agentInboxSearchParam) {
        const selectedInbox = currentInboxes.find((inbox) => inbox.selected);
        if (!selectedInbox) {
          currentInboxes[0].selected = true;
          updateQueryParams(
            [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
            [currentInboxes[0].id, "0", "10", "interrupted"]
          );
          setAgentInboxes(currentInboxes);
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(currentInboxes)
          );
        } else {
          updateQueryParams(
            [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
            [selectedInbox.id, "0", "10", "interrupted"]
          );
          setAgentInboxes(currentInboxes);
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(currentInboxes)
          );
        }

        // Mark initial load as complete
        if (!initialLoadComplete.current) {
          initialLoadComplete.current = true;
        }

        return;
      }

      let finalSelectedInboxId: string | null = null;

      // Param exists: Find inbox by param ID
      const selectedByParam = currentInboxes.find(
        (inbox) => inbox.id === agentInboxSearchParam
      );

      if (selectedByParam) {
        finalSelectedInboxId = selectedByParam.id;
        logger.log("Found inbox by search param:", finalSelectedInboxId);
      } else {
        // Param exists but inbox not found: Select first
        finalSelectedInboxId = currentInboxes[0]?.id || null;
        logger.log(
          "Inbox for search param not found, selecting first inbox:",
          finalSelectedInboxId
        );
        if (finalSelectedInboxId) {
          // Update URL to reflect the actual selection
          updateQueryParams(AGENT_INBOX_PARAM, finalSelectedInboxId);
        }
      }

      // Apply the selection to the inboxes array
      const updatedInboxes = currentInboxes.map((inbox) => ({
        ...inbox,
        selected: inbox.id === finalSelectedInboxId,
      }));

      // Update state only if it has changed to avoid loops
      if (JSON.stringify(updatedInboxes) !== JSON.stringify(agentInboxes)) {
        logger.log(
          "Updating agentInboxes state with selection:",
          updatedInboxes
        );
        setAgentInboxes(updatedInboxes);
      }
    },
    [
      getSearchParam,
      getItem,
      agentInboxes, // Include agentInboxes state to compare against
      updateQueryParams,
      hasEnvConfig,
    ]
  );

  /**
   * Add a new agent inbox
   * @param {AgentInbox} agentInbox - The agent inbox to add
   */
  const addAgentInbox = useCallback(
    (agentInbox: AgentInbox) => {
      const newInbox = {
        ...agentInbox,
        id: agentInbox.id || uuidv4(),
      };

      const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);

      // Handle empty inboxes
      if (!agentInboxesStr || agentInboxesStr === "[]") {
        setAgentInboxes([newInbox]);
        setItem(AGENT_INBOXES_LOCAL_STORAGE_KEY, JSON.stringify([newInbox]));
        // Set agent inbox, offset, and limit
        updateQueryParams(
          [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
          [newInbox.id, "0", "10", "interrupted"]
        );
        return;
      }

      try {
        const parsedAgentInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);

        // Add the new inbox and mark as selected
        const updatedInboxes = parsedAgentInboxes.map((inbox) => ({
          ...inbox,
          selected: false,
        }));

        updatedInboxes.push({
          ...newInbox,
          selected: true,
        });

        setAgentInboxes(updatedInboxes);
        setItem(
          AGENT_INBOXES_LOCAL_STORAGE_KEY,
          JSON.stringify(updatedInboxes)
        );

        // Update URL to show the new inbox
        updateQueryParams(AGENT_INBOX_PARAM, newInbox.id);

        // Use router refresh to update the UI without full page reload
        router.refresh();
      } catch (error) {
        logger.error("Error adding agent inbox", error);
        toast({
          title: "Error",
          description: "Failed to add agent inbox. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [getItem, setItem, updateQueryParams, router]
  );

  /**
   * Delete an agent inbox by ID
   * @param {string} id - The ID of the agent inbox to delete
   */
  const deleteAgentInbox = useCallback(
    (id: string) => {
      const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);

      if (!agentInboxesStr || agentInboxesStr === "[]") {
        return;
      }

      try {
        const parsedAgentInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);
        const wasSelected =
          parsedAgentInboxes.find((inbox) => inbox.id === id)?.selected ||
          false;
        const updatedInboxes = parsedAgentInboxes.filter(
          (inbox) => inbox.id !== id
        );

        // Handle empty result
        if (!updatedInboxes.length) {
          updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
          setAgentInboxes([]);
          setItem(AGENT_INBOXES_LOCAL_STORAGE_KEY, JSON.stringify([]));

          // Use router.push with just the current path
          router.push("/");
          return;
        }

        // Update state
        setAgentInboxes(updatedInboxes);

        // If we deleted the selected inbox, select the first one
        if (wasSelected && updatedInboxes.length > 0) {
          const firstInbox = updatedInboxes[0];
          const selectedInboxes = updatedInboxes.map((inbox) => ({
            ...inbox,
            selected: inbox.id === firstInbox.id,
          }));

          setAgentInboxes(selectedInboxes);
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(selectedInboxes)
          );
          updateQueryParams(AGENT_INBOX_PARAM, firstInbox.id);
        } else {
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(updatedInboxes)
          );
        }

        // Refresh data without full page reload
        router.refresh();
      } catch (error) {
        logger.error("Error deleting agent inbox", error);
        toast({
          title: "Error",
          description: "Failed to delete agent inbox. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [getItem, setItem, updateQueryParams, router]
  );

  /**
   * Change the selected agent inbox
   * @param {string} id - The ID of the agent inbox to select
   * @param {boolean} replaceAll - Whether to replace all query parameters
   */
  const changeAgentInbox = useCallback(
    (id: string, replaceAll?: boolean) => {
      // Update React state
      setAgentInboxes((prevInboxes) =>
        prevInboxes.map((inbox) => ({
          ...inbox,
          selected: inbox.id === id,
        }))
      );

      // Only update localStorage when NOT using env config
      if (!hasEnvConfig) {
        const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);
        if (agentInboxesStr && agentInboxesStr !== "[]") {
          try {
            const parsedInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);
            const updatedInboxes = parsedInboxes.map((inbox) => ({
              ...inbox,
              selected: inbox.id === id,
            }));

            setItem(
              AGENT_INBOXES_LOCAL_STORAGE_KEY,
              JSON.stringify(updatedInboxes)
            );
          } catch (error) {
            logger.error("Error updating selected inbox in localStorage", error);
          }
        }
      }

      // Update URL parameters
      if (!replaceAll) {
        // Set agent inbox, offset, limit, and inbox param
        updateQueryParams(
          [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
          [id, "0", "10", "interrupted"]
        );
      } else {
        const newParams = new URLSearchParams({
          [AGENT_INBOX_PARAM]: id,
          [OFFSET_PARAM]: "0",
          [LIMIT_PARAM]: "10",
          [INBOX_PARAM]: "interrupted",
        });
        // Always navigate to root to show Agent Inbox screen
        router.push("/?" + newParams.toString());
      }
    },
    [getItem, setItem, updateQueryParams, router, hasEnvConfig]
  );

  /**
   * Update an existing agent inbox
   * @param {AgentInbox} updatedInbox - The updated agent inbox
   */
  const updateAgentInbox = useCallback(
    (updatedInbox: AgentInbox) => {
      const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);

      if (!agentInboxesStr || agentInboxesStr === "[]") {
        return;
      }

      try {
        const parsedInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);
        const currentInbox = parsedInboxes.find(
          (inbox) => inbox.id === updatedInbox.id
        );

        if (!currentInbox) {
          logger.error("Inbox not found for update:", updatedInbox.id);
          return;
        }

        const wasSelected = currentInbox.selected;

        const updatedInboxes = parsedInboxes.map((inbox) =>
          inbox.id === updatedInbox.id
            ? { ...updatedInbox, selected: wasSelected }
            : inbox
        );

        setAgentInboxes(updatedInboxes);
        setItem(
          AGENT_INBOXES_LOCAL_STORAGE_KEY,
          JSON.stringify(updatedInboxes)
        );

        // Refresh data without full page reload
        router.refresh();
      } catch (error) {
        logger.error("Error updating agent inbox", error);
        toast({
          title: "Error",
          description: "Failed to update agent inbox. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [getItem, setItem, router]
  );

  return {
    agentInboxes,
    getAgentInboxes,
    addAgentInbox,
    deleteAgentInbox,
    changeAgentInbox,
    updateAgentInbox,
  };
}
