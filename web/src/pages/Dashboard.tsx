// web/src/pages/Dashboard.tsx
// Main authenticated dashboard view with command interface for RealLeads.ai
// Users can type natural language commands to manage leads

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

// Define the structure of a command in our history
interface Command {
  id: string;
  input: string;
  timestamp: Date;
  result?: any;
  error?: string;
}

export default function Dashboard() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // User's email from authentication
  const [userEmail, setUserEmail] = useState<string>("");

  // Current command being typed in the input box
  const [commandInput, setCommandInput] = useState<string>("");

  // History of all commands executed in this session
  const [commandHistory, setCommandHistory] = useState<Command[]>([]);

  // Loading state while command is being processed
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Navigation hook for redirecting
  const navigate = useNavigate();

  // ============================================================================
  // AUTHENTICATION & INITIALIZATION
  // ============================================================================

  useEffect(() => {
    // Check if user is logged in when component mounts
    checkUser();
  }, []);

  const checkUser = async () => {
    // Get current session from Supabase
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // No session found - redirect to login
      navigate("/login");
      return;
    }

    // Extract and display user's email
    setUserEmail(session.user.email || "Unknown");
  };

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  const executeCommand = async () => {
    // Don't execute if input is empty
    if (!commandInput.trim()) {
      return;
    }

    // Prevent double-execution while processing
    if (isExecuting) {
      return;
    }

    setIsExecuting(true);

    // Create a command record for history
    const commandId = Date.now().toString();
    const newCommand: Command = {
      id: commandId,
      input: commandInput,
      timestamp: new Date(),
    };

    try {
      // ========================================================================
      // STEP 1: Get the authentication token
      // ========================================================================
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session - please log in again");
      }

      console.log("Executing command:", commandInput);
      console.log("Sending to:", "/api/command"); // Log the URL we're using

      // ========================================================================
      // STEP 2: Send command to backend
      // CRITICAL: We use /api/command (not /command) so Vite proxy routes it
      // to the backend at http://localhost:3001/api/command
      // ========================================================================
      const response = await fetch("/api/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Send JWT token for authentication
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          input: commandInput,
        }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      // ========================================================================
      // STEP 3: Handle response
      // ========================================================================
      if (!response.ok) {
        // Backend returned an error status code
        let errorMessage = `Server error: ${response.status}`;

        try {
          // Try to parse error details from response
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If parsing fails, try to get text
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      // Try to parse successful response
      const result = await response.json();
      console.log("Command result:", result);

      // Add successful result to command history
      newCommand.result = result;
      setCommandHistory((prev) => [newCommand, ...prev]);
    } catch (error) {
      // ========================================================================
      // ERROR HANDLING
      // ========================================================================
      console.error("Command execution error:", error);

      // Format error message for display
      let errorMessage = "Unknown error occurred";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Add error to command history
      newCommand.error = errorMessage;
      setCommandHistory((prev) => [newCommand, ...prev]);

      // Show user-friendly error alert
      alert(`Error executing command: ${errorMessage}`);
    } finally {
      // ========================================================================
      // CLEANUP
      // ========================================================================
      setIsExecuting(false);
      // Clear input box for next command
      setCommandInput("");
    }
  };

  // ============================================================================
  // SIGN OUT
  // ============================================================================

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ============================================================================
  // RENDER UI
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">RealLeads.ai</h1>
              <p className="text-sm text-gray-600">Signed in as: {userEmail}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Command Input Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Command Center
          </h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyPress={(e) => {
                // Allow Enter key to execute command
                if (e.key === "Enter" && !isExecuting) {
                  executeCommand();
                }
              }}
              placeholder='Try: "create a lead for John Smith at john@example.com"'
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isExecuting}
            />

            <button
              onClick={executeCommand}
              disabled={isExecuting || !commandInput.trim()}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isExecuting ? "Executing..." : "Execute"}
            </button>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            Type natural language commands to manage your leads
          </p>
        </div>

        {/* Command History Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Command History
          </h2>

          {commandHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No commands executed yet. Try creating a lead!
            </p>
          ) : (
            <div className="space-y-4">
              {commandHistory.map((command) => (
                <div
                  key={command.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  {/* Command Input */}
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Command:
                    </span>
                    <p className="text-gray-900 mt-1">{command.input}</p>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-gray-500 mb-2">
                    {command.timestamp.toLocaleString()}
                  </div>

                  {/* Result or Error */}
                  {command.error ? (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <span className="text-sm font-medium text-red-800">
                        Error:
                      </span>
                      <p className="text-red-700 mt-1 text-sm">
                        {command.error}
                      </p>
                    </div>
                  ) : command.result ? (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <span className="text-sm font-medium text-green-800">
                        Result:
                      </span>
                      <pre className="text-green-700 mt-1 text-sm overflow-x-auto">
                        {JSON.stringify(command.result, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
