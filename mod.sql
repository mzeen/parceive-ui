--Add Call to LoopExecution

ALTER TABLE LoopExecution RENAME TO Temporary;
CREATE TABLE "LoopExecution"(Id INTEGER PRIMARY KEY NOT NULL,No INTEGER NOT NULL,Execution INTEGER NOT NULL,Parent INTEGER,Duration INT,Call INTEGER);
INSERT INTO LoopExecution SELECT Id, No, Execution, Parent, Duration, (SELECT c.Id FROM Call c, Segment s, LoopIteration i WHERE c.Id = s.Call AND s.Id = i.Segment) AS CALL FROM Temporary;
DROP TABLE Temporary;

-- Add Caller propertie to Call
ALTER TABLE Call RENAME TO Temporary;
CREATE TABLE "Call"(Id CHAR(50) PRIMARY KEY NOT NULL,Process INT NOT NULL,Thread INT NOT NULL,Function INT NOT NULL,Instruction INT NOT NULL,Start CHAR(12),End CHAR(12),Caller CHAR(50));
INSERT INTO Call SELECT Id, Process, Thread, Function, Instruction, Start, End, (SELECT Call FROM Segment WHERE Id=(SELECT Segment FROM Instruction WHERE Id=Instruction)) AS Caller FROM Temporary;
DROP TABLE Temporary;

-- intermediary index for performance reasons
CREATE INDEX IF NOT EXISTS CALL_TABLE_ID ON Call(Id);
CREATE INDEX IF NOT EXISTS CALL_TABLE_CALLER ON Call(Caller);

-- Group calls by Function and Caller so we don't have to do it in javascript
DROP TABLE IF EXISTS CallGroup;
CREATE TABLE "CallGroup"(Id INT PRIMARY KEY NOT NULL, Function INT NOT NULL,Caller CHAR(50),Count INT NOT NULL,Parent INT);
INSERT INTO CallGroup SELECT ROWID, Function, Caller, COUNT(*), NULL FROM Call GROUP BY Function, Caller;

-- Add CallGroup, CallsOther, LoopCount and Duration propertie to Call
ALTER TABLE Call RENAME TO Temporary;
CREATE TABLE "Call"(Id CHAR(50) PRIMARY KEY NOT NULL,Process INT NOT NULL,Thread INT NOT NULL,Function INT NOT NULL,Instruction INT NOT NULL,Start CHAR(12),End CHAR(12),Caller CHAR(50),CallGroup INT, CallsOther INTEGER, LoopCount INTEGER, Duration INTEGER);
INSERT INTO Call SELECT Id, Process, Thread, Function, Instruction, Start, End, Caller, (SELECT g.Id FROM CallGroup g WHERE c.Function = g.Function AND c.Caller = g.Caller) AS CallGroup,(SELECT COUNT(t.Id) FROM Temporary t WHERE t.Caller = c.Id ) AS CallsOther, (SELECT COUNT(*) FROM LoopExecution e WHERE e.Call = c.Id) AS LoopCount, End - Start AS Duration FROM Temporary c;
DROP TABLE Temporary;

-- Fill in Parent for CallGroup
UPDATE CallGroup SET Parent=(SELECT c.CallGroup FROM Call c WHERE c.Id = CallGroup.Caller);

CREATE INDEX IF NOT EXISTS ACCESS_TABLE_ID ON Access(Id);
CREATE INDEX IF NOT EXISTS CALL_TABLE_ID ON Call(Id);
CREATE INDEX IF NOT EXISTS FILE_TABLE_ID ON File(Id);
CREATE INDEX IF NOT EXISTS FUNCTION_TABLE_ID ON Function(Id);
CREATE INDEX IF NOT EXISTS INSTRUCTION_TABLE_ID ON Instruction(Id);
CREATE INDEX IF NOT EXISTS REFERENCE_TABLE_ID ON Reference(Reference);
CREATE INDEX IF NOT EXISTS SEGMENT_TABLE_ID ON Segment(Id);
CREATE INDEX IF NOT EXISTS THREAD_TABLE_ID ON Thread(Id);

CREATE INDEX IF NOT EXISTS ACCESS_TABLE_INSTRUCTION ON Access(Instruction);
CREATE INDEX IF NOT EXISTS ACCESS_TABLE_REFERENCE ON Access(Reference);

CREATE INDEX IF NOT EXISTS CALL_TABLE_CALLER ON Call(Caller);
CREATE INDEX IF NOT EXISTS CALL_TABLE_FUNCTION ON Call(Function);
CREATE INDEX IF NOT EXISTS CALL_TABLE_CALL_GROUP ON Call(CallGroup);

CREATE INDEX IF NOT EXISTS FUNCTION_TABLE_FILE ON Function(File);

CREATE INDEX IF NOT EXISTS INSTRUCTION_TABLE_SEGMENT ON Instruction(Segment);

CREATE INDEX IF NOT EXISTS REFERENCE_TABLE_ALLOCATOR ON Reference(Allocator);

CREATE INDEX IF NOT EXISTS SEGMENT_TABLE_CALL ON Segment(Call);

CREATE INDEX IF NOT EXISTS THREAD_TABLE_INSTRUCTION ON Thread(Instruction);
CREATE INDEX IF NOT EXISTS THREAD_TABLE_PARENT ON Thread(ParentThread);
CREATE INDEX IF NOT EXISTS THREAD_TABLE_CHILD ON Thread(ChildThread);

CREATE INDEX IF NOT EXISTS CALL_GROUP_TABLE_FUNCTION ON CallGroup(Function);
CREATE INDEX IF NOT EXISTS CALL_GROUP_TABLE_CALLER ON CallGroup(Caller);
CREATE INDEX IF NOT EXISTS CALL_GROUP_TABLE_PARENT ON CallGroup(Parent);

VACUUM;
