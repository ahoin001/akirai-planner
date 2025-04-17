"use client";
import { Sheet } from "@silk-hq/components";
import { BottomSheet } from "./bottom-sheet";
import "./examplebottomsheet.css";

const ExampleBottomSheet = () => {
  return (
    <BottomSheet
      presentTrigger={
        <p>dummy block</p>
        // <SheetTriggerCard color="blue">Bottom Sheet</SheetTriggerCard>
      }
      sheetContent={
        <div className={"ExampleBottomSheet-root"}>
          <Sheet.Handle
            className="ExampleBottomSheet-handle"
            action="dismiss"
          />
          <div className="ExampleBottomSheet-illustration" />
          <div className="ExampleBottomSheet-information">
            <Sheet.Title className="ExampleBottomSheet-title">
              Activity Added to Your Calendar
            </Sheet.Title>
            <Sheet.Description className="ExampleBottomSheet-description">
              Your activity has been successfully scheduled. We’ll send you a
              reminder as the date approaches.
            </Sheet.Description>
          </div>
          <Sheet.Trigger
            className="ExampleBottomSheet-validateTrigger"
            action="dismiss"
          >
            Got it
          </Sheet.Trigger>
        </div>
      }
    />
  );
};

export { ExampleBottomSheet };
