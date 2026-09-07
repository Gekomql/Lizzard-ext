/**
 * The names of the two messages the extension sends itself.
 *
 * Both ends of a `sendMessage` have to agree on a string, and a string agreed
 * on in two files is a string that will disagree eventually. They live here
 * rather than in either end because the worker has no business importing a
 * module that touches a document, and the content script has no business
 * importing the worker.
 */

/** Content script → worker. "Am I the tab with the animal in it?" */
export const WHO = "lizard:who";

/** Worker → content script. "You are." / "You are not." */
export const HOLDER = "lizard:holder";
