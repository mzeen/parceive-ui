ALTER TABLE LoopExecution RENAME TO Temporary;
CREATE TABLE "LoopExecution"(
  Id INT PRIMARY KEY NOT NULL,
  Loop INT NOT NULL,
  ParentIteration INT,
  Duration INT,
  Call INT
);
INSERT INTO LoopExecution SELECT
  Id,
  Loop,
  ParentIteration,
  Duration,
  (SELECT s.Call FROM Segment s, LoopIteration i WHERE s.LoopIteration = i.Id AND i.Execution = t.Id) AS call
FROM Temporary t;
DROP TABLE Temporary;

CREATE INDEX IF NOT EXISTS LOOP_TABLE_ID ON Loop(Id);
CREATE INDEX IF NOT EXISTS LOOP_EXECUTION_TABLE_ID ON LoopExecution(Id);
CREATE INDEX IF NOT EXISTS LOOP_ITERATION_TABLE_ID ON LoopIteration(Id);

CREATE INDEX IF NOT EXISTS LOOP_EXECUTION_TABLE_CALL ON LoopExecution(Call);
CREATE INDEX IF NOT EXISTS LOOP_EXECUTION_TABLE_PARENT ON LoopExecution(ParentIteration);
CREATE INDEX IF NOT EXISTS LOOP_EXECUTION_TABLE_LOOP ON LoopExecution(Loop);

CREATE INDEX IF NOT EXISTS LOOP_ITERATION_TABLE_EXECUTION ON LoopIteration(Execution);
