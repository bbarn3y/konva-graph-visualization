import Konva from 'konva';

export interface ConnectionData {
    connectionId: string;
    startShapeId: string;
    endShapeId: string;
    points: number[];
    arrowShape: Konva.Arrow;
}

export interface Connectable {
    connections: ConnectionData[];
    addConnection(connectionData: ConnectionData): void;
}

export function isConnectable(object: any): object is Connectable {
    const actResult = object && 'connections' in object;
    return actResult
};