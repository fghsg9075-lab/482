import { test, expect, describe } from "bun:test";
import { analyzeTopics } from "./recommendationEngine";
import { MCQItem } from "../types";

describe("analyzeTopics", () => {
    test("should handle empty questions and answers", () => {
        const result = analyzeTopics([], {});
        expect(result.weak).toEqual([]);
        expect(result.average).toEqual([]);
        expect(result.strong).toEqual([]);
        expect(result.stats).toEqual({});
    });

    test("should categorize all topics as strong when all answers are correct", () => {
        const questions: MCQItem[] = [
            { question: "Q1", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic1" },
            { question: "Q2", options: ["A", "B"], correctAnswer: 1, explanation: "", topic: "Topic2" }
        ];
        const answers = { 0: 0, 1: 1 };
        const result = analyzeTopics(questions, answers);

        expect(result.strong).toContain("Topic1");
        expect(result.strong).toContain("Topic2");
        expect(result.weak).toEqual([]);
        expect(result.average).toEqual([]);
    });

    test("should categorize all topics as weak when all answers are wrong", () => {
        const questions: MCQItem[] = [
            { question: "Q1", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic1" }
        ];
        const answers = { 0: 1 };
        const result = analyzeTopics(questions, answers);

        expect(result.weak).toContain("Topic1");
        expect(result.strong).toEqual([]);
    });

    test("should correctly categorize mixed performance", () => {
        const questions: MCQItem[] = [
            // Topic1: 0/1 = 0% (Weak)
            { question: "Q1", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic1" },
            // Topic2: 1/2 = 50% (Average)
            { question: "Q2", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic2" },
            { question: "Q3", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic2" },
            // Topic3: 4/5 = 80% (Strong)
            { question: "Q4", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic3" },
            { question: "Q5", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic3" },
            { question: "Q6", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic3" },
            { question: "Q7", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic3" },
            { question: "Q8", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "Topic3" }
        ];
        const answers = {
            0: 1, // Topic1 wrong
            1: 0, 2: 1, // Topic2 1 correct, 1 wrong
            3: 0, 4: 0, 5: 0, 6: 0, 7: 1 // Topic3 4 correct, 1 wrong
        };
        const result = analyzeTopics(questions, answers);

        expect(result.weak).toContain("Topic1");
        expect(result.average).toContain("Topic2");
        expect(result.strong).toContain("Topic3");
    });

    test("should default to 'General' topic if topic is missing", () => {
        const questions: any[] = [
            { question: "Q1", options: ["A", "B"], correctAnswer: 0, explanation: "" }
        ];
        const answers = { 0: 0 };
        const result = analyzeTopics(questions as MCQItem[], answers);

        expect(result.strong).toContain("General");
    });

    test("should trim topic names", () => {
        const questions: MCQItem[] = [
            { question: "Q1", options: ["A", "B"], correctAnswer: 0, explanation: "", topic: "  TrimMe  " }
        ];
        const answers = { 0: 0 };
        const result = analyzeTopics(questions, answers);

        expect(result.strong).toContain("TrimMe");
        expect(result.stats["TrimMe"]).toBeDefined();
    });
});
