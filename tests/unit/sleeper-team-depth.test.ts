import { describe, expect, it } from "vitest";
import { sleeperDepthChart } from "@/lib/sleeper/team-depth";

describe("sleeper team depth chart", () => {
  it("takes the first three players at each NBA depth-chart slot", () => {
    const chart = sleeperDepthChart(
      [
        { player_id: "1", full_name: "Jamal Murray", team: "DEN", depth_chart_position: "PG", depth_chart_order: 1 },
        { player_id: "2", full_name: "Tyus Jones", team: "DEN", depth_chart_position: "PG", depth_chart_order: 2 },
        { player_id: "3", full_name: "KJ Simpson", team: "DEN", depth_chart_position: "PG", depth_chart_order: 3 },
        { player_id: "4", full_name: "Christian Braun", team: "DEN", depth_chart_position: "SG", depth_chart_order: 1 },
        { player_id: "5", full_name: "Cameron Johnson", team: "DEN", depth_chart_position: "SF", depth_chart_order: 1 },
        { player_id: "6", full_name: "DeMar DeRozan", team: "DEN", depth_chart_position: "SF", depth_chart_order: 2 },
        { player_id: "7", full_name: "Julian Strawther", team: "DEN", depth_chart_position: "SF", depth_chart_order: 3 },
        { player_id: "8", full_name: "Lonnie Walker", team: "DEN", depth_chart_position: "SF", depth_chart_order: 4 },
        { player_id: "9", full_name: "Aaron Gordon", team: "DEN", depth_chart_position: "PF", depth_chart_order: 1 },
        { player_id: "10", full_name: "Spencer Jones", team: "DEN", depth_chart_position: "PF", depth_chart_order: 3 },
        { player_id: "11", full_name: "Alpha Diallo", team: "DEN", depth_chart_position: "PF", depth_chart_order: 4 },
        { player_id: "12", full_name: "Nikola Jokic", team: "DEN", depth_chart_position: "C", depth_chart_order: 1 },
        { player_id: "13", full_name: "Marvin Bagley", team: "DEN", depth_chart_position: "C", depth_chart_order: 2 },
        { player_id: "14", full_name: "Zeke Nnaji", team: "DEN", depth_chart_position: "C", depth_chart_order: 4 },
        { player_id: "15", full_name: "DaRon Holmes", team: "DEN", depth_chart_position: "C", depth_chart_order: 5 },
        { player_id: "16", full_name: "Shai", team: "OKC", depth_chart_position: "PG", depth_chart_order: 1 },
      ],
      "den",
    );

    expect(chart.PG.map((row) => row.fullName)).toEqual(["Jamal Murray", "Tyus Jones", "KJ Simpson"]);
    expect(chart.SG.map((row) => row.fullName)).toEqual(["Christian Braun"]);
    expect(chart.SF.map((row) => row.fullName)).toEqual([
      "Cameron Johnson",
      "DeMar DeRozan",
      "Julian Strawther",
    ]);
    expect(chart.PF.map((row) => row.fullName)).toEqual(["Aaron Gordon", "Spencer Jones", "Alpha Diallo"]);
    expect(chart.C.map((row) => row.fullName)).toEqual(["Nikola Jokic", "Marvin Bagley", "Zeke Nnaji"]);
  });
});
