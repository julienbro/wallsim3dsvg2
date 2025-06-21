export const commands = [];

export function executeCommand(command) {
    commands.push(command);
    command.execute();
}

export function undoCommand() {
    const command = commands.pop();
    if (command) {
        command.undo();
    }
}